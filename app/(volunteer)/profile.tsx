import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import { getAuth, clearAuth } from "../../lib/auth";
import type { AuthUser } from "../../lib/auth";
import type { ApiResponse, Volunteer } from "../../lib/types";

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const TIME_SLOTS = [
  { suffix: "morning", label: "Morning (8 – 11 AM)" },
  { suffix: "midday", label: "Midday (11 AM – 2 PM)" },
  { suffix: "afternoon", label: "Afternoon (2 – 5 PM)" },
  { suffix: "evening", label: "Evening (5 – 8 PM)" },
];

const VEHICLE_TYPES = ["sedan", "suv", "minivan", "accessible"];

export default function VolunteerProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [volunteer, setVolunteer] = useState<Volunteer | null>(null);
  const [availability, setAvailability] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editVehicle, setEditVehicle] = useState("");
  const [editMaxPassengers, setEditMaxPassengers] = useState("");

  useEffect(() => { getAuth().then(setUser); }, []);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api<ApiResponse<Volunteer>>(`/api/volunteers/${user.id}`);
      if (res.data) {
        setVolunteer(res.data);
        setAvailability(res.data.availability || []);
        setEditName(res.data.name);
        setEditPhone(res.data.phone);
        setEditAddress(res.data.address);
        setEditVehicle(res.data.vehicle_type);
        setEditMaxPassengers(String(res.data.max_passengers));
      }
    } catch {
      Alert.alert("Error", "Could not load profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  async function saveField(field: string, value: any) {
    setSaving(true);
    try {
      const res = await api<ApiResponse<Volunteer>>(`/api/volunteers/${user?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      if (res.error) {
        Alert.alert("Error", res.error);
      } else if (res.data) {
        setVolunteer(res.data);
        setEditingField(null);
      }
    } catch {
      Alert.alert("Error", "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleSlot(slotKey: string) {
    const newAvailability = availability.includes(slotKey)
      ? availability.filter((k) => k !== slotKey)
      : [...availability, slotKey];

    setAvailability(newAvailability);
    setSaving(true);
    try {
      const res = await api<ApiResponse<Volunteer>>(`/api/volunteers/${user?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ availability: newAvailability }),
      });
      if (res.error) {
        Alert.alert("Error", res.error);
        setAvailability(volunteer?.availability || []);
      }
    } catch {
      setAvailability(volunteer?.availability || []);
    } finally {
      setSaving(false);
    }
  }

  function getSelectedCountForDay(dayKey: string): number {
    return TIME_SLOTS.filter((ts) => availability.includes(`${dayKey}_${ts.suffix}`)).length;
  }

  function getSelectedSummaryForDay(dayKey: string): string {
    const selected = TIME_SLOTS.filter((ts) => availability.includes(`${dayKey}_${ts.suffix}`));
    if (selected.length === 0) return "Not available";
    if (selected.length === TIME_SLOTS.length) return "All day";
    return selected.map((ts) => ts.label.split(" (")[0]).join(", ");
  }

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await clearAuth(); router.replace("/"); } },
    ]);
  }

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color={colors.secondary} /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} tintColor={colors.secondary} />}
    >
      <Text style={styles.heading}>My{"\n"}<Text style={styles.headingAccent}>Profile</Text></Text>

      {volunteer && (
        <>
          {/* Personal Info */}
          <View style={styles.card}>
            <EditableRow label="Name" value={editName} isEditing={editingField === "name"} onEdit={() => { setEditingField("name"); setEditName(volunteer.name); }} onChangeText={setEditName} onSave={() => saveField("name", editName.trim())} onCancel={() => setEditingField(null)} saving={saving} />
            <EditableRow label="Phone" value={editPhone} isEditing={editingField === "phone"} onEdit={() => { setEditingField("phone"); setEditPhone(volunteer.phone); }} onChangeText={setEditPhone} onSave={() => saveField("phone", editPhone.trim())} onCancel={() => setEditingField(null)} saving={saving} keyboardType="phone-pad" />
            <EditableRow label="Address" value={editAddress} isEditing={editingField === "address"} onEdit={() => { setEditingField("address"); setEditAddress(volunteer.address); }} onChangeText={setEditAddress} onSave={() => saveField("address", editAddress.trim())} onCancel={() => setEditingField(null)} saving={saving} />
          </View>

          {/* Vehicle */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vehicle</Text>
            {editingField === "vehicle_type" ? (
              <>
                <View style={styles.chipGrid}>
                  {VEHICLE_TYPES.map((v) => (
                    <TouchableOpacity key={v} style={[styles.chip, editVehicle === v && styles.chipSelected]} onPress={() => setEditVehicle(v)}>
                      <Text style={[styles.chipLabel, editVehicle === v && styles.chipLabelSelected]}>{v.charAt(0).toUpperCase() + v.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={() => saveField("vehicle_type", editVehicle)} disabled={saving}><Text style={styles.saveText}>{saving ? "..." : "Save"}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingField(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                </View>
              </>
            ) : (
              <EditableRow label="Type" value={volunteer.vehicle_type.charAt(0).toUpperCase() + volunteer.vehicle_type.slice(1)} isEditing={false} onEdit={() => setEditingField("vehicle_type")} onChangeText={() => {}} onSave={() => {}} onCancel={() => setEditingField(null)} saving={saving} />
            )}
            <EditableRow label="Max Passengers" value={editMaxPassengers} isEditing={editingField === "max_passengers"} onEdit={() => { setEditingField("max_passengers"); setEditMaxPassengers(String(volunteer.max_passengers)); }} onChangeText={setEditMaxPassengers} onSave={() => saveField("max_passengers", parseInt(editMaxPassengers) || 4)} onCancel={() => setEditingField(null)} saving={saving} keyboardType="phone-pad" />
          </View>

          {/* Availability — Accordion per day */}
          <View style={styles.card}>
            <View style={styles.availHeader}>
              <Text style={styles.cardTitle}>Availability</Text>
              {saving && <ActivityIndicator size="small" color={colors.secondary} />}
            </View>

            {DAYS.map((day) => {
              const isExpanded = expandedDay === day.key;
              const count = getSelectedCountForDay(day.key);
              const summary = getSelectedSummaryForDay(day.key);

              return (
                <View key={day.key}>
                  <TouchableOpacity
                    style={[styles.dayRow, isExpanded && styles.dayRowExpanded]}
                    onPress={() => setExpandedDay(isExpanded ? null : day.key)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dayLabel}>{day.label}</Text>
                      <Text style={[styles.daySummary, count > 0 && styles.daySummaryActive]}>{summary}</Text>
                    </View>
                    {count > 0 && (
                      <View style={styles.countBadge}>
                        <Text style={styles.countText}>{count}</Text>
                      </View>
                    )}
                    <Text style={styles.arrow}>{isExpanded ? "▲" : "▼"}</Text>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.slotsContainer}>
                      {TIME_SLOTS.map((ts) => {
                        const slotKey = `${day.key}_${ts.suffix}`;
                        const selected = availability.includes(slotKey);
                        return (
                          <TouchableOpacity
                            key={slotKey}
                            style={[styles.slotRow, selected && styles.slotRowSelected]}
                            onPress={() => toggleSlot(slotKey)}
                          >
                            <View style={[styles.slotCheck, selected && styles.slotCheckSelected]}>
                              {selected && <Text style={styles.checkMark}>✓</Text>}
                            </View>
                            <Text style={[styles.slotLabel, selected && styles.slotLabelSelected]}>{ts.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Change Password */}
      <View style={styles.card}>
        <TouchableOpacity onPress={() => setShowChangePassword(!showChangePassword)}>
          <Text style={styles.cardTitle}>Change Password {showChangePassword ? "▲" : "▼"}</Text>
        </TouchableOpacity>
        {showChangePassword && (
          <>
            <TextInput style={styles.editInput} placeholder="Current password" placeholderTextColor={colors.textSecondary} secureTextEntry value={currentPw} onChangeText={setCurrentPw} />
            <TextInput style={styles.editInput} placeholder="New password (min 6 chars)" placeholderTextColor={colors.textSecondary} secureTextEntry value={newPw} onChangeText={setNewPw} />
            <TouchableOpacity
              style={[styles.chipSelected, { alignItems: "center", paddingVertical: 12, borderRadius: radius.pill, marginTop: spacing.xs }]}
              disabled={pwLoading}
              onPress={async () => {
                if (!currentPw || !newPw) { Alert.alert("Required", "Fill in both fields."); return; }
                setPwLoading(true);
                try {
                  const res = await api<ApiResponse<any>>("/api/auth/change-password", {
                    method: "POST",
                    body: JSON.stringify({ role: "volunteer", id: user?.id, current_password: currentPw, new_password: newPw }),
                  });
                  if (res.error) Alert.alert("Error", res.error);
                  else { Alert.alert("Success", "Password changed."); setCurrentPw(""); setNewPw(""); setShowChangePassword(false); }
                } catch { Alert.alert("Error", "Could not change password."); }
                finally { setPwLoading(false); }
              }}
            >
              <Text style={styles.chipLabelSelected}>{pwLoading ? "..." : "Update Password"}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function EditableRow({ label, value, isEditing, onEdit, onChangeText, onSave, onCancel, saving, keyboardType }: {
  label: string; value: string; isEditing: boolean; onEdit: () => void; onChangeText: (t: string) => void; onSave: () => void; onCancel: () => void; saving: boolean; keyboardType?: "default" | "phone-pad";
}) {
  if (isEditing) {
    return (
      <View style={styles.editRow}>
        <Text style={styles.infoLabel}>{label}</Text>
        <TextInput style={styles.editInput} value={value} onChangeText={onChangeText} autoFocus keyboardType={keyboardType || "default"} />
        <View style={styles.editActions}>
          <TouchableOpacity onPress={onSave} disabled={saving}><Text style={styles.saveText}>{saving ? "..." : "Save"}</Text></TouchableOpacity>
          <TouchableOpacity onPress={onCancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
      <TouchableOpacity onPress={onEdit}><Text style={styles.editBtn}>Edit</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  heading: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.textPrimary, lineHeight: 40, marginBottom: spacing.lg },
  headingAccent: { color: colors.secondary },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm },
  availHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary, width: 100 },
  infoValue: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary },
  editBtn: { fontSize: fontSize.sm, fontWeight: "600", color: colors.secondary },
  editRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  editInput: { backgroundColor: colors.background, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.secondary, paddingHorizontal: spacing.sm, paddingVertical: 10, fontSize: fontSize.md, color: colors.textPrimary, marginVertical: spacing.xs },
  editActions: { flexDirection: "row", gap: spacing.md, justifyContent: "flex-end" },
  saveText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.secondary },
  cancelText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.secondary, backgroundColor: colors.secondaryLight },
  chipLabel: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
  chipLabelSelected: { color: colors.secondary },
  // Day accordion
  dayRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayRowExpanded: { backgroundColor: colors.background, borderBottomWidth: 0 },
  dayLabel: { fontSize: fontSize.md, fontWeight: "700", color: colors.textPrimary },
  daySummary: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  daySummaryActive: { color: colors.secondary },
  countBadge: { backgroundColor: colors.secondary, width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: spacing.sm },
  countText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  arrow: { fontSize: 12, color: colors.textSecondary },
  slotsContainer: { backgroundColor: colors.background, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  slotRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: spacing.sm, borderRadius: radius.sm, marginTop: spacing.xs },
  slotRowSelected: { backgroundColor: colors.secondaryLight },
  slotCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, marginRight: spacing.sm, justifyContent: "center", alignItems: "center" },
  slotCheckSelected: { borderColor: colors.secondary, backgroundColor: colors.secondary },
  checkMark: { color: "#fff", fontSize: 13, fontWeight: "700" },
  slotLabel: { fontSize: fontSize.sm, color: colors.textPrimary },
  slotLabelSelected: { fontWeight: "600", color: colors.secondary },
  signOutButton: { borderRadius: radius.pill, padding: spacing.md, alignItems: "center", marginTop: spacing.lg, borderWidth: 2, borderColor: colors.secondary, backgroundColor: colors.surface },
  signOutText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.secondary },
});
