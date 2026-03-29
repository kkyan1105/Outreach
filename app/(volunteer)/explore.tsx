import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { useFocusEffect } from "@react-navigation/native";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import { getAuth } from "../../lib/auth";
import type { ApiResponse, OutingRequest } from "../../lib/types";

const DESTINATION_EMOJI: Record<string, string> = {
  grocery: "\u{1F6D2}", church: "\u26EA", park: "\u{1F333}",
  pharmacy: "\u{1F48A}", other: "\u{1F4CD}",
};
const MARKER_COLORS: Record<string, string> = {
  grocery: "#4A7C59", church: "#8B5C8A", park: "#4A7C59",
  pharmacy: "#E8694A", other: "#6B8070",
};
const DISTANCE_OPTIONS = [1, 3, 5, 10];
const DESTINATION_FILTER_TYPES = [
  { key: "all", label: "All" },
  { key: "grocery", label: "\u{1F6D2} Grocery" },
  { key: "park", label: "\u{1F333} Park" },
  { key: "church", label: "\u26EA Church" },
  { key: "pharmacy", label: "\u{1F48A} Pharmacy" },
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME_SLOTS = [
  { key: "morning", label: "Morning 8-11", startHour: 8, endHour: 11 },
  { key: "midday", label: "Midday 11-2", startHour: 11, endHour: 14 },
  { key: "afternoon", label: "Afternoon 2-5", startHour: 14, endHour: 17 },
  { key: "evening", label: "Evening 5-8", startHour: 17, endHour: 20 },
];

type ViewMode = "list" | "map";
interface RequestWithGeo extends OutingRequest {
  _lat?: number; _lng?: number; _seniorName?: string;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function getNext7Days() {
  const days: { key: string; label: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    days.push({ key, label });
  }
  return days;
}

const DEFAULT_REGION = { latitude: 36.16, longitude: -86.78, latitudeDelta: 0.08, longitudeDelta: 0.08 };

export default function ExploreScreen() {
  const [volunteerId, setVolunteerId] = useState<string | null>(null);
  const [volunteerLat, setVolunteerLat] = useState(DEFAULT_REGION.latitude);
  const [volunteerLng, setVolunteerLng] = useState(DEFAULT_REGION.longitude);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [destinationType, setDestinationType] = useState("all");
  const [distanceRadius, setDistanceRadius] = useState(5);
  const [requests, setRequests] = useState<RequestWithGeo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [mapRequests, setMapRequests] = useState<any[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [myOutings, setMyOutings] = useState<any[]>([]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Set<string>>(new Set());
  const mapRef = useRef<MapView>(null);
  const [currentMarkerIndex, setCurrentMarkerIndex] = useState(0);

  // Bottom action panel
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);
  const [showRidePicker, setShowRidePicker] = useState(false);

  const dateChips = getNext7Days();

  useEffect(() => {
    getAuth().then(async (user) => {
      if (user?.id) {
        setVolunteerId(user.id);
        try {
          const res = await api<ApiResponse<any>>(`/api/volunteers/${user.id}`);
          if (res.data) { setVolunteerLat(res.data.lat); setVolunteerLng(res.data.lng); }
        } catch {}
      }
    });
  }, []);

  const fetchRequests = useCallback(async () => {
    try {
      let url = `/api/requests?status=pending`;
      if (destinationType !== "all") url += `&destination_type=${destinationType}`;
      url += `&lat=${volunteerLat}&lng=${volunteerLng}&radius=${distanceRadius}`;
      const res = await api<ApiResponse<RequestWithGeo[]>>(url);
      if (res.data) setRequests(res.data);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [destinationType, distanceRadius, volunteerLat, volunteerLng]);

  const fetchMapData = useCallback(async () => {
    try {
      let url = `/api/requests?status=pending`;
      if (destinationType !== "all") url += `&destination_type=${destinationType}`;
      url += `&lat=${volunteerLat}&lng=${volunteerLng}&radius=${distanceRadius}`;
      const reqRes = await api<ApiResponse<any[]>>(url);
      if (!reqRes.data) return;
      const seniorRes = await api<ApiResponse<any[]>>("/api/seniors");
      const seniorMap = new Map<string, any>();
      (seniorRes.data || []).forEach((s: any) => seniorMap.set(s.id, s));
      const enriched = reqRes.data.map((r: any) => {
        const senior = seniorMap.get(r.senior_id);
        return { ...r, _lat: senior?.lat, _lng: senior?.lng, _seniorName: senior?.name };
      }).filter((r: any) => r._lat && r._lng);
      setMapRequests(enriched);
    } catch {}
  }, [destinationType, distanceRadius, volunteerLat, volunteerLng]);

  const fetchMyOutings = useCallback(async () => {
    if (!volunteerId) return;
    try {
      const res = await api<ApiResponse<any[]>>(`/api/outings?volunteer_id=${volunteerId}`);
      if (res.data) setMyOutings(res.data.filter((o: any) => o.status === "confirmed"));
    } catch {}
  }, [volunteerId]);

  useFocusEffect(useCallback(() => { fetchRequests(); fetchMapData(); fetchMyOutings(); }, [fetchRequests, fetchMapData, fetchMyOutings]));

  // Client-side filters
  function applyFilters<T extends RequestWithGeo>(items: T[]): T[] {
    let f = items;
    if (selectedDates.size > 0) f = f.filter((r) => selectedDates.has(r.preferred_date));
    if (selectedDays.size > 0) f = f.filter((r) => selectedDays.has(new Date(r.preferred_date + "T00:00:00").getDay()));
    if (selectedTimeSlots.size > 0) f = f.filter((r) => {
      const [h] = (r.preferred_time_start || "00:00").split(":").map(Number);
      return Array.from(selectedTimeSlots).some((k) => { const s = TIME_SLOTS.find((t) => t.key === k); return s ? h >= s.startHour && h < s.endHour : false; });
    });
    return f;
  }
  const filteredRequests = applyFilters(requests);
  const filteredMapRequests = applyFilters(mapRequests);

  // Actions
  async function doAcceptNew(requestId: string) {
    if (!volunteerId) return;
    setAcceptingId(requestId);
    try {
      const res = await api<ApiResponse<any>>("/api/outings/manual", { method: "POST", body: JSON.stringify({ volunteer_id: volunteerId, request_id: requestId }) });
      if (res.error) Alert.alert("Error", res.error);
      else { Alert.alert("Accepted", "New ride created."); removeIds([requestId]); fetchMyOutings(); }
    } catch { Alert.alert("Error", "Failed."); }
    finally { setAcceptingId(null); setActionRequestId(null); }
  }

  async function doAddToRide(outingId: string, requestId: string) {
    setAcceptingId(requestId);
    try {
      const res = await api<ApiResponse<any>>(`/api/outings/${outingId}/add`, { method: "POST", body: JSON.stringify({ request_ids: [requestId] }) });
      if (res.error) Alert.alert("Error", res.error);
      else { Alert.alert("Added", "Passenger added."); removeIds([requestId]); fetchMyOutings(); }
    } catch { Alert.alert("Error", "Failed."); }
    finally { setAcceptingId(null); setActionRequestId(null); setShowRidePicker(false); }
  }

  async function handleBatchCreate() {
    if (!volunteerId || selectedIds.size === 0) return;
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await api<ApiResponse<any>>("/api/outings/batch", { method: "POST", body: JSON.stringify({ volunteer_id: volunteerId, request_ids: ids }) });
      if (res.error) Alert.alert("Error", res.error);
      else { Alert.alert("Ride Created", `${ids.length} passengers grouped.`); removeIds(ids); setSelectedIds(new Set()); setSelectMode(false); fetchMyOutings(); }
    } catch { Alert.alert("Error", "Failed."); }
    finally { setBatchLoading(false); }
  }

  function removeIds(ids: string[]) {
    const s = new Set(ids);
    setRequests((p) => p.filter((r) => !s.has(r.id)));
    setMapRequests((p: any[]) => p.filter((r: any) => !s.has(r.id)));
  }

  function toggleSelect(id: string) { setSelectedIds((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  function toggleDate(k: string) { setSelectedDates((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }); }
  function toggleDay(i: number) { setSelectedDays((p) => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; }); }
  function toggleTimeSlot(k: string) { setSelectedTimeSlots((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; }); }

  function handleBadgeTap() {
    if (filteredMapRequests.length === 0) return;
    const idx = currentMarkerIndex % filteredMapRequests.length;
    const req = filteredMapRequests[idx];
    if (req._lat && req._lng && mapRef.current) mapRef.current.animateToRegion({ latitude: req._lat, longitude: req._lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
    setCurrentMarkerIndex(idx + 1);
  }

  // Get compatible rides for a request
  function getCompatibleRides(reqId: string) {
    const req = [...requests, ...mapRequests].find((r: any) => r.id === reqId);
    return myOutings.filter((o: any) => o.destination_type === req?.destination_type);
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.heading}>Find <Text style={styles.headingAccent}>Rides</Text></Text>
        <View style={styles.modeToggle}>
          <TouchableOpacity style={[styles.modeBtn, viewMode === "map" && styles.modeBtnActive]} onPress={() => setViewMode("map")}><Text style={[styles.modeBtnText, viewMode === "map" && styles.modeBtnTextActive]}>Map</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.modeBtn, viewMode === "list" && styles.modeBtnActive]} onPress={() => setViewMode("list")}><Text style={[styles.modeBtnText, viewMode === "list" && styles.modeBtnTextActive]}>List</Text></TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {DESTINATION_FILTER_TYPES.map((dt) => (
            <TouchableOpacity key={dt.key} style={[styles.chip, destinationType === dt.key && styles.chipActive]} onPress={() => setDestinationType(dt.key)}>
              <Text style={[styles.chipText, destinationType === dt.key && styles.chipTextActive]}>{dt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.filterRow}>
          {DISTANCE_OPTIONS.map((d) => (
            <TouchableOpacity key={d} style={[styles.sm, distanceRadius === d && styles.smActive]} onPress={() => setDistanceRadius(d)}>
              <Text style={[styles.smText, distanceRadius === d && styles.smTextActive]}>{d} mi</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.sm, selectedDates.size === 0 && styles.smActive, { marginRight: 4 }]} onPress={() => setSelectedDates(new Set())}><Text style={[styles.smText, selectedDates.size === 0 && styles.smTextActive]}>All</Text></TouchableOpacity>
          {dateChips.map((dc) => (
            <TouchableOpacity key={dc.key} style={[styles.sm, selectedDates.has(dc.key) && styles.smActive, { marginRight: 4 }]} onPress={() => toggleDate(dc.key)}>
              <Text style={[styles.smText, selectedDates.has(dc.key) && styles.smTextActive]}>{dc.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.sm, selectedDays.size === 0 && styles.smActive, { marginRight: 4 }]} onPress={() => setSelectedDays(new Set())}><Text style={[styles.smText, selectedDays.size === 0 && styles.smTextActive]}>All</Text></TouchableOpacity>
          {DAY_NAMES.map((n, i) => (
            <TouchableOpacity key={n} style={[styles.sm, selectedDays.has(i) && styles.smActive, { marginRight: 4 }]} onPress={() => toggleDay(i)}>
              <Text style={[styles.smText, selectedDays.has(i) && styles.smTextActive]}>{n}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity style={[styles.sm, selectedTimeSlots.size === 0 && styles.smActive, { marginRight: 4 }]} onPress={() => setSelectedTimeSlots(new Set())}><Text style={[styles.smText, selectedTimeSlots.size === 0 && styles.smTextActive]}>All</Text></TouchableOpacity>
          {TIME_SLOTS.map((s) => (
            <TouchableOpacity key={s.key} style={[styles.sm, selectedTimeSlots.has(s.key) && styles.smActive, { marginRight: 4 }]} onPress={() => toggleTimeSlot(s.key)}>
              <Text style={[styles.smText, selectedTimeSlots.has(s.key) && styles.smTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Map */}
      {viewMode === "map" ? (
        <View style={{ flex: 1 }}>
          <MapView ref={mapRef} style={{ flex: 1 }} initialRegion={{ latitude: volunteerLat, longitude: volunteerLng, latitudeDelta: distanceRadius * 0.02, longitudeDelta: distanceRadius * 0.02 }} showsUserLocation>
            <Marker coordinate={{ latitude: volunteerLat, longitude: volunteerLng }} title="You" pinColor={colors.secondary} />
            {filteredMapRequests.map((req: any) => (
              <Marker key={req.id} coordinate={{ latitude: req._lat, longitude: req._lng }} pinColor={MARKER_COLORS[req.destination_type] || colors.primary}>
                <Callout onPress={() => { setActionRequestId(req.id); setShowRidePicker(false); }}>
                  <View style={{ padding: 8, minWidth: 160 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700" }}>{DESTINATION_EMOJI[req.destination_type] || ""} {req.destination_type}</Text>
                    {req._seniorName && <Text style={{ fontSize: 12, color: "#666" }}>{req._seniorName}</Text>}
                    <Text style={{ fontSize: 12, color: "#666" }}>{formatDate(req.preferred_date)}</Text>
                    <Text style={{ fontSize: 12, color: "#666" }}>{formatTime(req.preferred_time_start)} – {formatTime(req.preferred_time_end)}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "700", color: colors.secondary, marginTop: 6 }}>Tap for options</Text>
                  </View>
                </Callout>
              </Marker>
            ))}
          </MapView>
          <TouchableOpacity style={styles.mapBadge} onPress={handleBadgeTap} activeOpacity={0.7}>
            <Text style={styles.mapBadgeText}>{filteredMapRequests.length} requests nearby</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* List */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} tintColor={colors.secondary} />}>
          {loading ? <ActivityIndicator size="large" color={colors.secondary} style={{ marginTop: 40 }} /> :
          filteredRequests.length === 0 ? (
            <View style={styles.emptyCard}><Text style={styles.emptyTitle}>No pending requests</Text><Text style={styles.emptyText}>Try expanding filters.</Text></View>
          ) : (
            <>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm }}>
                <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary }}>{filteredRequests.length} requests</Text>
                <TouchableOpacity onPress={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}>
                  <Text style={{ fontSize: fontSize.sm, fontWeight: "600", color: colors.secondary }}>{selectMode ? "Cancel" : "Select Multiple"}</Text>
                </TouchableOpacity>
              </View>
              {selectMode && selectedIds.size > 0 && (
                <View style={styles.batchBar}>
                  <Text style={{ flex: 1, fontSize: fontSize.sm, fontWeight: "600", color: colors.secondary }}>{selectedIds.size} selected</Text>
                  <TouchableOpacity style={styles.batchBtn} onPress={handleBatchCreate} disabled={batchLoading}>
                    <Text style={{ fontSize: fontSize.xs, fontWeight: "700", color: "#fff" }}>{batchLoading ? "..." : "New Ride"}</Text>
                  </TouchableOpacity>
                </View>
              )}
              {filteredRequests.map((req) => {
                const emoji = DESTINATION_EMOJI[req.destination_type] || "\u{1F4CD}";
                const destLabel = req.destination_type.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
                const isSelected = selectedIds.has(req.id);
                return (
                  <TouchableOpacity key={req.id} style={[styles.card, isSelected && { borderWidth: 2, borderColor: colors.secondary }]}
                    onPress={selectMode ? () => toggleSelect(req.id) : undefined} activeOpacity={selectMode ? 0.7 : 1}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      {selectMode && <View style={[styles.checkbox, isSelected && styles.checkboxOn]}>{isSelected && <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>✓</Text>}</View>}
                      <View style={styles.emojiBox}><Text style={{ fontSize: 24 }}>{emoji}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: fontSize.md, fontWeight: "700", color: colors.textPrimary }}>{destLabel}</Text>
                        {req.destination_name ? <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>{req.destination_name}</Text> : null}
                      </View>
                    </View>
                    <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>📅 {formatDate(req.preferred_date)}</Text>
                    <Text style={{ fontSize: fontSize.sm, color: colors.textSecondary }}>🕐 {formatTime(req.preferred_time_start)} – {formatTime(req.preferred_time_end)}</Text>
                    {!selectMode && (
                      <View style={{ flexDirection: "row", gap: spacing.xs }}>
                        <TouchableOpacity style={styles.actionBtn} onPress={() => doAcceptNew(req.id)} disabled={acceptingId === req.id}>
                          {acceptingId === req.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionBtnText}>New Ride</Text>}
                        </TouchableOpacity>
                        {myOutings.length > 0 && (
                          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={() => { setActionRequestId(req.id); setShowRidePicker(true); }}>
                            <Text style={styles.actionBtnOutlineText}>Add to Ride</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      )}

      {/* Bottom action panel */}
      {actionRequestId && (
        <View style={styles.panel}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md }}>
            <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary }}>Choose action</Text>
            <TouchableOpacity onPress={() => { setActionRequestId(null); setShowRidePicker(false); }}><Text style={{ fontSize: 20, color: colors.textSecondary }}>✕</Text></TouchableOpacity>
          </View>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => doAcceptNew(actionRequestId)}>
              <Text style={styles.actionBtnText}>New Ride</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={() => setShowRidePicker(!showRidePicker)}>
              <Text style={styles.actionBtnOutlineText}>Add to Ride</Text>
            </TouchableOpacity>
          </View>
          {showRidePicker && (() => {
            const rides = getCompatibleRides(actionRequestId);
            if (rides.length === 0) return <Text style={{ marginTop: spacing.sm, fontSize: fontSize.sm, color: colors.textSecondary }}>No compatible confirmed rides</Text>;
            return (
              <View style={{ marginTop: spacing.sm }}>
                {rides.map((o: any) => (
                  <TouchableOpacity key={o.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}
                    onPress={() => doAddToRide(o.id, actionRequestId)}>
                    <Text style={{ fontSize: fontSize.sm, color: colors.textPrimary }}>
                      {DESTINATION_EMOJI[o.destination_type] || ""} {o.destination_type} — {formatDate(o.scheduled_date)} ({o.seniors?.length || 0} passengers)
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingTop: 60, paddingBottom: spacing.xs },
  heading: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.sm },
  headingAccent: { color: colors.secondary },
  modeToggle: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, borderWidth: 1.5, borderColor: colors.border },
  modeBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.pill, alignItems: "center" },
  modeBtnActive: { backgroundColor: colors.secondary },
  modeBtnText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.textSecondary },
  modeBtnTextActive: { color: "#FFFFFF" },
  filterSection: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: spacing.xs },
  chip: { paddingHorizontal: spacing.sm, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface, marginRight: 4 },
  chipActive: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  chipText: { fontSize: fontSize.xs, fontWeight: "600", color: colors.textSecondary },
  chipTextActive: { color: colors.secondary },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  sm: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  smActive: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  smText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  smTextActive: { color: colors.secondary },
  mapBadge: { position: "absolute", bottom: 20, alignSelf: "center", backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  mapBadgeText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textPrimary },
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.xl, alignItems: "center" },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center" },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, gap: spacing.sm },
  emojiBox: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.secondaryLight, justifyContent: "center", alignItems: "center" },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border, justifyContent: "center", alignItems: "center" },
  checkboxOn: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  actionBtn: { flex: 1, backgroundColor: colors.secondary, borderRadius: radius.pill, paddingVertical: 14, alignItems: "center" },
  actionBtnText: { fontSize: fontSize.md, fontWeight: "700", color: "#FFFFFF" },
  actionBtnOutline: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.secondary },
  actionBtnOutlineText: { fontSize: fontSize.md, fontWeight: "700", color: colors.secondary },
  batchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.secondaryLight, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm },
  batchBtn: { backgroundColor: colors.secondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 },
  panel: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 40, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 10, elevation: 10 },
});
