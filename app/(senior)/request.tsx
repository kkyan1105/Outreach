import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import { getAuth } from "../../lib/auth";
import type { ApiResponse, OutingRequest } from "../../lib/types";

const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const SEARCH_RADIUS_METERS = 8000;

const DESTINATION_TYPES = [
  { key: "grocery",  label: "Grocery",  emoji: "🛒", color: colors.tileGreen,  placeType: "supermarket" },
  { key: "pharmacy", label: "Pharmacy", emoji: "💊", color: colors.tileCoral,  placeType: "drugstore" },
  { key: "church",   label: "Church",   emoji: "⛪", color: colors.tilePurple, placeType: "church" },
  { key: "park",     label: "Park",     emoji: "🌳", color: colors.tileGreen,  placeType: "park" },
];

const PHARMACY_CHAINS = [
  { key: "cvs",       label: "CVS Pharmacy" },
  { key: "walgreens", label: "Walgreens" },
  { key: "walmart",   label: "Walmart Pharmacy" },
  { key: "kroger",    label: "Kroger Pharmacy" },
  { key: "publix",    label: "Publix Pharmacy" },
];

const GROCERY_CHAIN_KEYWORDS = [
  "walmart", "target", "costco", "sam's club", "bj's",
  "kroger", "king soopers", "ralphs", "fred meyer", "fry's", "smith's",
  "pick 'n save", "mariano's", "harris teeter", "dillons",
  "albertsons", "safeway", "vons", "jewel-osco", "shaw's", "acme",
  "tom thumb", "randalls", "star market", "united supermarkets",
  "publix", "h-e-b", "heb", "meijer", "wegmans", "aldi", "lidl",
  "whole foods", "trader joe's", "trader joes", "sprouts", "winco",
  "food lion", "giant", "stop & shop", "shoprite", "weis",
  "ingles", "stater bros", "brookshire",
];

function filterGroceryChains(places: NearbyPlace[]): NearbyPlace[] {
  return places.filter((p) => {
    const name = p.name.toLowerCase();
    return GROCERY_CHAIN_KEYWORDS.some((kw) => name.includes(kw));
  });
}

const TIME_SLOTS = [
  { key: "morning",   label: "Morning",   emoji: "🌅", start: "09:00", end: "12:00", desc: "9am – 12pm" },
  { key: "afternoon", label: "Afternoon", emoji: "☀️",  start: "12:00", end: "16:00", desc: "12pm – 4pm" },
  { key: "evening",   label: "Evening",   emoji: "🌇", start: "16:00", end: "19:00", desc: "4pm – 7pm" },
];

interface NearbyPlace {
  place_id: string;
  name: string;
  vicinity: string;
  distance: number;
  open_now?: boolean;
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getDateOptions() {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    const label =
      i === 0 ? "Today" :
      i === 1 ? "Tomorrow" :
      d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
    dates.push({ iso, label });
  }
  return dates;
}

function calcDistanceMiles(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SeniorRequestScreen() {
  const router = useRouter();
  const [seniorId, setSeniorId] = useState<string | null>(null);
  const [seniorLat, setSeniorLat] = useState<number | null>(null);
  const [seniorLng, setSeniorLng] = useState<number | null>(null);

  const [destinationType, setDestinationType] = useState("");
  // grocery / church / park: multi-select by place_id
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<string[]>([]);
  const [anyPlace, setAnyPlace] = useState(false);
  // pharmacy: multi-select by chain key
  const [selectedChains, setSelectedChains] = useState<string[]>([]);

  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("morning");
  const [submitting, setSubmitting] = useState(false);

  const dateOptions = getDateOptions();
  const timeSlot = TIME_SLOTS.find((t) => t.key === selectedTimeSlot)!;

  useEffect(() => {
    getAuth().then(async (user) => {
      if (!user) return;
      setSeniorId(user.id);
      try {
        const res = await api<ApiResponse<any>>(`/api/seniors?id=${user.id}`);
        const senior = res.data?.[0];
        if (senior?.lat) {
          setSeniorLat(senior.lat);
          setSeniorLng(senior.lng);
        }
      } catch (e) { console.log("[Senior] API error:", e); }
    });
  }, []);

  const fetchNearbyPlaces = useCallback(async (placeType: string) => {
    if (!seniorLat || !seniorLng || !GOOGLE_KEY) return;
    setPlacesLoading(true);
    setNearbyPlaces([]);
    try {
      const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${seniorLat},${seniorLng}&radius=${SEARCH_RADIUS_METERS}&type=${placeType}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
        console.warn("Places API error:", json.status, json.error_message);
      }
      const places: NearbyPlace[] = (json.results || []).slice(0, 15).map((p: any) => ({
        place_id: p.place_id,
        name: p.name,
        vicinity: p.vicinity,
        distance: calcDistanceMiles(seniorLat, seniorLng, p.geometry.location.lat, p.geometry.location.lng),
        open_now: p.opening_hours?.open_now,
      }));
      places.sort((a, b) => a.distance - b.distance);
      setNearbyPlaces(places);
    } catch {
      Alert.alert("Error", "Could not load nearby places.");
    } finally {
      setPlacesLoading(false);
    }
  }, [seniorLat, seniorLng]);

  function handleSelectType(key: string, placeType: string) {
    setDestinationType(key);
    setSelectedPlaceIds([]);
    setAnyPlace(false);
    setSelectedChains([]);
    setDropdownOpen(false);
    fetchNearbyPlaces(placeType);
  }

  function togglePlaceId(id: string) {
    setAnyPlace(false);
    setSelectedPlaceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleChain(key: string) {
    setSelectedChains((prev) =>
      prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]
    );
  }

  function toggleAny() {
    if (!anyPlace) {
      setSelectedPlaceIds([]);
      setAnyPlace(true);
      setDropdownOpen(false);
    } else {
      setAnyPlace(false);
    }
  }

  async function handleSubmit() {
    if (!destinationType) {
      Alert.alert("Required", "Please choose a destination type.");
      return;
    }
    if (destinationType === "pharmacy" && selectedChains.length === 0) {
      Alert.alert("Required", "Please select at least one pharmacy.");
      return;
    }
    if (destinationType === "church" && selectedPlaceIds.length === 0 && !anyPlace) {
      Alert.alert("Required", "Please select your church.");
      return;
    }
    if (!seniorId) {
      Alert.alert("Error", "No senior profile found. Please register first.");
      return;
    }

    let destination_name: string | null = null;
    if (destinationType === "pharmacy") {
      destination_name = selectedChains
        .map((k) => PHARMACY_CHAINS.find((c) => c.key === k)?.label ?? k)
        .join(", ");
    } else if (anyPlace) {
      destination_name = "Any";
    } else if (selectedPlaceIds.length > 0) {
      destination_name = selectedPlaceIds
        .map((id) => nearbyPlaces.find((p) => p.place_id === id)?.name ?? id)
        .join("; ");
    }

    setSubmitting(true);
    try {
      const res = await api<ApiResponse<OutingRequest>>("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          senior_id: seniorId,
          destination_type: destinationType,
          destination_name,
          preferred_date: selectedDate,
          preferred_time_start: timeSlot.start,
          preferred_time_end: timeSlot.end,
        }),
      });
      if (res.error) {
        Alert.alert("Error", res.error);
      } else {
        Alert.alert(
          "Request Sent!",
          "We'll find nearby seniors going to the same place and match you with a volunteer driver.",
          [{ text: "View My Status", onPress: () => router.replace("/(senior)/status") }]
        );
      }
    } catch {
      Alert.alert("Error", "Could not connect to server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const selectedTypeDef = DESTINATION_TYPES.find((d) => d.key === destinationType);

  // Trigger label helpers
  function pharmacyTriggerLabel() {
    if (selectedChains.length === 0) return "Select pharmacies";
    if (selectedChains.length === 1) return PHARMACY_CHAINS.find((c) => c.key === selectedChains[0])?.label ?? "";
    return `${selectedChains.length} pharmacies selected`;
  }

  function placeTriggerLabel() {
    if (anyPlace) return "Any — I'm flexible";
    const placeholders: Record<string, string> = {
      grocery: "Select grocery stores",
      church: "Select churches",
      park: "Select parks",
    };
    if (selectedPlaceIds.length === 0) return placeholders[selectedTypeDef?.key ?? ""] ?? "Select places";
    if (selectedPlaceIds.length === 1) return nearbyPlaces.find((p) => p.place_id === selectedPlaceIds[0])?.name ?? "";
    return `${selectedPlaceIds.length} places selected`;
  }

  const hasPlaceSelection = selectedPlaceIds.length > 0 || anyPlace;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.heading}>Request an{"\n"}<Text style={styles.headingAccent}>Outing</Text></Text>
      <Text style={styles.subheading}>Select more options to increase your chances of being matched.</Text>

      {/* Destination type */}
      <Text style={styles.sectionLabel}>Where would you like to go?</Text>
      <View style={styles.destGrid}>
        {DESTINATION_TYPES.map((d) => {
          const selected = destinationType === d.key;
          return (
            <TouchableOpacity
              key={d.key}
              style={[styles.destTile, { backgroundColor: selected ? d.color : colors.surface, borderColor: selected ? d.color : colors.border }]}
              onPress={() => handleSelectType(d.key, d.placeType)}
            >
              <Text style={styles.destEmoji}>{d.emoji}</Text>
              <Text style={[styles.destLabel, { color: selected ? "#fff" : colors.textPrimary }]}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Place selection */}
      {destinationType !== "" && (
        <>
          {!seniorLat && destinationType !== "pharmacy" && (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>Loading your location…</Text>
            </View>
          )}

          {seniorLat && placesLoading && (
            <View style={styles.infoBox}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.infoText, { marginLeft: spacing.sm }]}>Finding nearby {selectedTypeDef?.label.toLowerCase()}s…</Text>
            </View>
          )}

          {/* Pharmacy: fixed chain list */}
          {destinationType === "pharmacy" && (
            <>
              <TouchableOpacity
                style={[styles.dropdownTrigger, selectedChains.length > 0 && styles.dropdownTriggerActive]}
                onPress={() => setDropdownOpen((o) => !o)}
              >
                <Text style={selectedChains.length > 0 ? styles.dropdownValueText : styles.dropdownPlaceholderText} numberOfLines={1}>
                  {pharmacyTriggerLabel()}
                </Text>
                <Text style={styles.dropdownChevron}>{dropdownOpen ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {dropdownOpen && (
                <View style={styles.dropdownList}>
                  {PHARMACY_CHAINS.map((chain) => {
                    const sel = selectedChains.includes(chain.key);
                    return (
                      <TouchableOpacity
                        key={chain.key}
                        style={[styles.dropdownItem, sel && styles.dropdownItemSelected]}
                        onPress={() => toggleChain(chain.key)}
                      >
                        <Text style={[styles.dropdownItemName, sel && styles.dropdownItemNameSelected]}>{chain.label}</Text>
                        {sel && <Text style={styles.checkmark}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}

          {/* Grocery / Church / Park: places dropdown */}
          {destinationType !== "pharmacy" && !placesLoading && seniorLat && (
            <>
              <TouchableOpacity
                style={[styles.dropdownTrigger, hasPlaceSelection && styles.dropdownTriggerActive]}
                onPress={() => setDropdownOpen((o) => !o)}
              >
                <Text style={hasPlaceSelection ? styles.dropdownValueText : styles.dropdownPlaceholderText} numberOfLines={1}>
                  {placeTriggerLabel()}
                </Text>
                <Text style={styles.dropdownChevron}>{dropdownOpen ? "▲" : "▼"}</Text>
              </TouchableOpacity>
              {dropdownOpen && (() => {
                const list = destinationType === "grocery" ? filterGroceryChains(nearbyPlaces) : nearbyPlaces;
                return (
                  <View style={styles.dropdownList}>
                    {/* Any option — highlighted */}
                    <TouchableOpacity
                      style={[styles.anyItem, anyPlace && styles.anyItemSelected]}
                      onPress={toggleAny}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.anyItemLabel, anyPlace && styles.anyItemLabelSelected]}>
                          ✨ Any — I'm flexible
                        </Text>
                        <Text style={[styles.anyItemSub, anyPlace && styles.anyItemSubSelected]}>
                          Match with more seniors & get picked up sooner
                        </Text>
                      </View>
                      {anyPlace && <Text style={styles.anyCheckmark}>✓</Text>}
                    </TouchableOpacity>
                    {list.length === 0 && (
                      <Text style={[styles.infoText, { padding: spacing.sm }]}>No places found nearby.</Text>
                    )}
                    {list.map((place) => {
                      const sel = selectedPlaceIds.includes(place.place_id);
                      return (
                        <TouchableOpacity
                          key={place.place_id}
                          style={[styles.dropdownItem, sel && styles.dropdownItemSelected]}
                          onPress={() => togglePlaceId(place.place_id)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dropdownItemName, sel && styles.dropdownItemNameSelected]} numberOfLines={1}>{place.name}</Text>
                            <Text style={styles.dropdownItemAddr} numberOfLines={1}>{place.vicinity} · {place.distance.toFixed(1)} mi</Text>
                          </View>
                          {sel && <Text style={styles.checkmark}>✓</Text>}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })()}
            </>
          )}
        </>
      )}

      {/* Date */}
      <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Which day?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateScroll} contentContainerStyle={styles.dateScrollContent}>
        {dateOptions.map((d) => {
          const selected = selectedDate === d.iso;
          return (
            <TouchableOpacity
              key={d.iso}
              style={[styles.dateChip, selected && styles.dateChipSelected]}
              onPress={() => setSelectedDate(d.iso)}
            >
              <Text style={[styles.dateChipLabel, selected && styles.dateChipLabelSelected]}>{d.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Time slot */}
      <Text style={styles.sectionLabel}>What time works?</Text>
      <View style={styles.timeRow}>
        {TIME_SLOTS.map((slot) => {
          const selected = selectedTimeSlot === slot.key;
          return (
            <TouchableOpacity
              key={slot.key}
              style={[styles.timeCard, selected && styles.timeCardSelected]}
              onPress={() => setSelectedTimeSlot(slot.key)}
            >
              <Text style={styles.timeEmoji}>{(slot as any).emoji}</Text>
              <Text style={[styles.timeLabel, selected && styles.timeLabelSelected]}>{slot.label}</Text>
              <Text style={[styles.timeDesc, selected && styles.timeDescSelected]}>{slot.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Submit */}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Find My Group</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  heading: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.textPrimary, lineHeight: 40, marginBottom: spacing.xs },
  headingAccent: { color: colors.primary },
  subheading: { fontSize: fontSize.lg, color: colors.textSecondary, lineHeight: 30, marginBottom: spacing.sm },
  sectionLabel: { fontSize: fontSize.xl, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm },
  destGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  destTile: {
    width: "47%", paddingVertical: spacing.md,
    borderRadius: radius.md, borderWidth: 2, alignItems: "center", gap: 4,
  },
  destEmoji: { fontSize: 36 },
  destLabel: { fontSize: fontSize.lg, fontWeight: "700" },
  infoBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.surface, borderRadius: radius.md,
    padding: spacing.md, marginBottom: spacing.md,
  },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary },
  checkmark: { fontSize: fontSize.md, color: colors.primary, fontWeight: "800", marginLeft: spacing.xs },
  matchHint: {
    fontSize: fontSize.sm, color: colors.primary, fontWeight: "600",
    backgroundColor: colors.primaryLight, borderRadius: radius.sm,
    padding: spacing.sm, marginBottom: spacing.sm, lineHeight: 20,
  },
  matchHintBelow: {
    fontSize: fontSize.xs, color: colors.textSecondary,
    textAlign: "center", marginTop: spacing.xs, marginBottom: spacing.md, lineHeight: 18,
  },
  dropdownTrigger: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 18, marginBottom: 4,
  },
  dropdownTriggerActive: { borderColor: colors.primary },
  dropdownPlaceholderText: { fontSize: fontSize.lg, color: colors.textSecondary, flex: 1 },
  dropdownValueText: { fontSize: fontSize.lg, color: colors.textPrimary, fontWeight: "600", flex: 1 },
  dropdownChevron: { fontSize: fontSize.md, color: colors.textSecondary, marginLeft: spacing.xs },
  dropdownList: {
    backgroundColor: colors.surface, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.border,
    marginBottom: spacing.sm, overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  dropdownItemSelected: { backgroundColor: colors.primaryLight },
  dropdownItemName: { fontSize: fontSize.md, fontWeight: "700", color: colors.textPrimary },
  dropdownItemNameSelected: { color: colors.primary },
  dropdownItemAddr: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  anyItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: spacing.md, paddingVertical: 16,
    borderBottomWidth: 2, borderBottomColor: colors.tileGold,
    backgroundColor: "#FFF8EC",
  },
  anyItemSelected: { backgroundColor: colors.tileGold },
  anyItemLabel: { fontSize: fontSize.lg, fontWeight: "800", color: colors.tileGold },
  anyItemLabelSelected: { color: "#fff" },
  anyItemSub: { fontSize: fontSize.sm, color: colors.tileGold, marginTop: 2, opacity: 0.85 },
  anyItemSubSelected: { color: "#fff", opacity: 0.9 },
  anyCheckmark: { fontSize: fontSize.lg, color: "#fff", fontWeight: "800", marginLeft: spacing.xs },
  dateScroll: { marginBottom: spacing.sm },
  dateScrollContent: { gap: spacing.sm, paddingRight: spacing.lg },
  dateChip: {
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderRadius: radius.pill, borderWidth: 2,
    borderColor: colors.border, backgroundColor: colors.surface,
  },
  dateChipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  dateChipLabel: { fontSize: fontSize.md, fontWeight: "600", color: colors.textSecondary },
  dateChipLabelSelected: { color: colors.primary },
  timeRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl },
  timeCard: {
    flex: 1, paddingVertical: spacing.md, paddingHorizontal: spacing.xs,
    borderRadius: radius.md, borderWidth: 2, borderColor: colors.border,
    backgroundColor: colors.surface, alignItems: "center", gap: 4,
  },
  timeCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  timeEmoji: { fontSize: 28 },
  timeLabel: { fontSize: fontSize.md, fontWeight: "700", color: colors.textSecondary },
  timeLabelSelected: { color: colors.primary },
  timeDesc: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2, textAlign: "center" },
  timeDescSelected: { color: colors.primary },
  submitButton: { backgroundColor: colors.primary, borderRadius: radius.pill, padding: spacing.md, alignItems: "center" },
  submitText: { fontSize: fontSize.xl, fontWeight: "700", color: "#FFFFFF" },
});
