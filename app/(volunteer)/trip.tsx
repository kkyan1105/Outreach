import { useState, useEffect, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Dimensions, Linking, Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapView, { Marker, Polyline, Callout } from "react-native-maps";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import { getAuth } from "../../lib/auth";
import type { ApiResponse } from "../../lib/types";

interface RoutePlanStop {
  type: "pickup" | "destination";
  senior_id?: string;
  senior_name?: string;
  address: string;
  lat: number;
  lng: number;
  eta: string;
  preferred_start?: string;
  preferred_end?: string;
  within_window: boolean;
  distance_from_prev_miles: number;
  duration_from_prev_minutes: number;
}

interface RoutePlan {
  departure_time: string;
  destination: { name: string; address: string; lat: number; lng: number };
  stops: RoutePlanStop[];
  total_distance_miles: number;
  total_duration_minutes: number;
  polyline: string;
  algorithm_used: string;
}

function decodePolyline(encoded: string): { latitude: number; longitude: number }[] {
  const points: { latitude: number; longitude: number }[] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function openInMaps(lat: number, lng: number, label: string) {
  const url = Platform.select({
    ios: `maps:0,0?q=${encodeURIComponent(label)}@${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`,
  });
  if (url) Linking.openURL(url);
}

const SCREEN_HEIGHT = Dimensions.get("window").height;

export default function TripDetailScreen() {
  const { outing_id } = useLocalSearchParams<{ outing_id: string }>();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [volunteerLat, setVolunteerLat] = useState(36.16);
  const [volunteerLng, setVolunteerLng] = useState(-86.78);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!outing_id) return;
    (async () => {
      // Get volunteer location
      const auth = await getAuth();
      if (auth?.id) {
        try {
          const vRes = await api<ApiResponse<any>>(`/api/volunteers/${auth.id}`);
          if (vRes.data) { setVolunteerLat(vRes.data.lat); setVolunteerLng(vRes.data.lng); }
        } catch {}
      }
      // Get route plan
      try {
        const res = await api<ApiResponse<RoutePlan>>(`/api/route/${outing_id}`);
        if (res.error) setError(res.error);
        else if (res.data) setRoute(res.data);
        else setError("No route data.");
      } catch { setError("Could not load route."); }
      finally { setLoading(false); }
    })();
  }, [outing_id]);

  useEffect(() => {
    if (!route || !mapRef.current) return;
    const coords = [
      { latitude: volunteerLat, longitude: volunteerLng },
      ...route.stops.map((s) => ({ latitude: s.lat, longitude: s.lng })),
    ];
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 300);
  }, [route, volunteerLat, volunteerLng]);

  function fitToAll() {
    if (!route || !mapRef.current) return;
    const coords = [
      { latitude: volunteerLat, longitude: volunteerLng },
      ...route.stops.map((s) => ({ latitude: s.lat, longitude: s.lng })),
    ];
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
      animated: true,
    });
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.secondary} /><Text style={styles.loadingText}>Planning route...</Text></View>;
  }

  if (error || !route) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Route Error</Text>
        <Text style={styles.errorText}>{error || "Unknown error"}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}><Text style={styles.backBtnText}>Go Back</Text></TouchableOpacity>
      </View>
    );
  }

  const polylineCoords = route.polyline ? decodePolyline(route.polyline) : [];
  const pickupStops = route.stops.filter((s) => s.type === "pickup");
  const destinationStop = route.stops.find((s) => s.type === "destination");

  return (
    <View style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        {/* Back */}
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>

        {/* Summary */}
        <View style={styles.card}>
          <Text style={styles.heading}>Route Plan</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Depart</Text>
              <Text style={styles.summaryValue}>{formatTime(route.departure_time)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Arrive</Text>
              <Text style={styles.summaryValue}>{destinationStop ? formatTime(destinationStop.eta) : "—"}</Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Distance</Text>
              <Text style={styles.summaryValue}>{route.total_distance_miles.toFixed(1)} mi</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Duration</Text>
              <Text style={styles.summaryValue}>{Math.round(route.total_duration_minutes)} min</Text>
            </View>
          </View>
          {/* Destination — tappable to open maps */}
          <TouchableOpacity style={styles.destRow} onPress={() => openInMaps(route.destination.lat, route.destination.lng, route.destination.name)}>
            <Text style={styles.destLabel}>📍 {route.destination.name}</Text>
            <Text style={styles.destAddress}>{route.destination.address}</Text>
            <Text style={styles.destLink}>Open in Maps →</Text>
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pickup Order</Text>

          {/* Start: Volunteer */}
          <View style={styles.timelineItem}>
            <View style={styles.timelineLine} />
            <View style={[styles.timelineDot, { backgroundColor: colors.secondary }]}>
              <Text style={styles.dotText}>🚗</Text>
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineETA}>{formatTime(route.departure_time)}</Text>
              <Text style={styles.timelineName}>You (Start)</Text>
            </View>
          </View>

          {/* Pickups */}
          {pickupStops.map((stop, idx) => {
            const ok = stop.within_window;
            return (
              <TouchableOpacity key={stop.senior_id || idx} style={styles.timelineItem} onPress={() => openInMaps(stop.lat, stop.lng, stop.senior_name || "Pickup")}>
                {idx < pickupStops.length - 1 || destinationStop ? <View style={styles.timelineLine} /> : null}
                <View style={[styles.timelineDot, { backgroundColor: ok ? colors.primary : colors.tileGold }]}>
                  <Text style={styles.dotText}>{idx + 1}</Text>
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineETA}>{formatTime(stop.eta)}</Text>
                    <View style={[styles.badge, { backgroundColor: ok ? colors.primaryLight : "#FFF8EC" }]}>
                      <Text style={[styles.badgeText, { color: ok ? colors.primary : colors.tileGold }]}>{ok ? "✓ On time" : "⚠ Outside window"}</Text>
                    </View>
                  </View>
                  <Text style={styles.timelineName}>{stop.senior_name}</Text>
                  <Text style={styles.timelineAddr}>{stop.address}</Text>
                  {stop.preferred_start && stop.preferred_end && (
                    <Text style={styles.timelineWindow}>Window: {formatTime(stop.preferred_start)} – {formatTime(stop.preferred_end)}</Text>
                  )}
                  <Text style={styles.openMaps}>Open in Maps →</Text>
                </View>
              </TouchableOpacity>
            );
          })}

          {/* Destination */}
          {destinationStop && (
            <TouchableOpacity style={styles.timelineItem} onPress={() => openInMaps(destinationStop.lat, destinationStop.lng, route.destination.name)}>
              <View style={[styles.timelineDot, { backgroundColor: colors.secondary }]}>
                <Text style={styles.dotText}>🏁</Text>
              </View>
              <View style={styles.timelineContent}>
                <Text style={styles.timelineETA}>{formatTime(destinationStop.eta)}</Text>
                <Text style={styles.timelineName}>{route.destination.name}</Text>
                <Text style={styles.timelineAddr}>{destinationStop.address}</Text>
                <Text style={styles.openMaps}>Open in Maps →</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Map */}
        <View style={styles.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.sectionTitle}>Route Map</Text>
            <TouchableOpacity onPress={fitToAll}><Text style={{ fontSize: 22 }}>📍</Text></TouchableOpacity>
          </View>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{ latitude: volunteerLat, longitude: volunteerLng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
              showsUserLocation
            >
              {/* Volunteer start */}
              <Marker coordinate={{ latitude: volunteerLat, longitude: volunteerLng }} pinColor={colors.secondary}>
                <Callout><View style={{ padding: 4 }}><Text style={{ fontWeight: "700" }}>🚗 You (Start)</Text></View></Callout>
              </Marker>

              {/* Pickup markers with numbers */}
              {pickupStops.map((stop, idx) => (
                <Marker key={stop.senior_id || idx} coordinate={{ latitude: stop.lat, longitude: stop.lng }} pinColor={stop.within_window ? colors.primary : colors.tileGold}>
                  <View style={styles.numberedPin}>
                    <Text style={styles.numberedPinText}>{idx + 1}</Text>
                  </View>
                  <Callout>
                    <View style={{ padding: 4, minWidth: 120 }}>
                      <Text style={{ fontWeight: "700" }}>Stop {idx + 1}: {stop.senior_name}</Text>
                      <Text style={{ fontSize: 12, color: "#666" }}>ETA: {formatTime(stop.eta)}</Text>
                    </View>
                  </Callout>
                </Marker>
              ))}

              {/* Destination marker */}
              {destinationStop && (
                <Marker coordinate={{ latitude: destinationStop.lat, longitude: destinationStop.lng }}>
                  <View style={[styles.numberedPin, { backgroundColor: colors.secondary }]}>
                    <Text style={styles.numberedPinText}>🏁</Text>
                  </View>
                  <Callout>
                    <View style={{ padding: 4, minWidth: 120 }}>
                      <Text style={{ fontWeight: "700" }}>{route.destination.name}</Text>
                      <Text style={{ fontSize: 12, color: "#666" }}>ETA: {formatTime(destinationStop.eta)}</Text>
                    </View>
                  </Callout>
                </Marker>
              )}

              {/* Route line */}
              {polylineCoords.length > 0 && (
                <Polyline coordinates={polylineCoords} strokeColor={colors.secondary} strokeWidth={4} />
              )}
            </MapView>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background, padding: spacing.lg },
  loadingText: { marginTop: spacing.sm, fontSize: fontSize.md, color: colors.textSecondary },
  errorTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.xs },
  errorText: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.lg },
  backBtn: { paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.secondary },
  backBtnText: { fontSize: fontSize.md, fontWeight: "700", color: "#fff" },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  backArrow: { fontSize: fontSize.lg, fontWeight: "700", color: colors.secondary, marginRight: spacing.xs },
  backLabel: { fontSize: fontSize.md, fontWeight: "600", color: colors.secondary },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  heading: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary, marginBottom: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  summaryItem: { flex: 1, backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.sm },
  summaryLabel: { fontSize: fontSize.xs, color: colors.textSecondary, fontWeight: "600", marginBottom: 2 },
  summaryValue: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary },
  destRow: { backgroundColor: colors.secondaryLight, borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.xs },
  destLabel: { fontSize: fontSize.md, fontWeight: "700", color: colors.textPrimary },
  destAddress: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  destLink: { fontSize: fontSize.sm, fontWeight: "600", color: colors.secondary, marginTop: spacing.xs },
  // Timeline
  timelineItem: { flexDirection: "row", alignItems: "flex-start", marginBottom: spacing.md, position: "relative" },
  timelineLine: { position: "absolute", left: 15, top: 32, bottom: -spacing.md, width: 2, backgroundColor: colors.border },
  timelineDot: { width: 32, height: 32, borderRadius: 16, justifyContent: "center", alignItems: "center", marginRight: spacing.sm },
  dotText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  timelineContent: { flex: 1 },
  timelineHeader: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  timelineETA: { fontSize: fontSize.md, fontWeight: "700", color: colors.textPrimary },
  badge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "600" },
  timelineName: { fontSize: fontSize.md, fontWeight: "600", color: colors.textPrimary, marginTop: 2 },
  timelineAddr: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  timelineWindow: { fontSize: fontSize.xs, color: colors.tileGold, marginTop: 2 },
  openMaps: { fontSize: fontSize.xs, fontWeight: "600", color: colors.secondary, marginTop: 4 },
  fitBtn: { fontSize: fontSize.sm, fontWeight: "600", color: colors.secondary },
  // Map
  mapContainer: { borderRadius: radius.sm, overflow: "hidden", height: SCREEN_HEIGHT * 0.4 },
  map: { width: "100%", height: "100%" },
  // Numbered pins
  numberedPin: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: "#fff" },
  numberedPinText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
