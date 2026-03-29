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
import type { ApiResponse, Senior } from "../../lib/types";

const INTERESTS = ["grocery", "church", "park", "museum", "library", "restaurant", "social_club"];

export default function SeniorProfileScreen() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [senior, setSenior] = useState<Senior | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingField, setEditingField] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editMobility, setEditMobility] = useState("");
  const [editEmergency, setEditEmergency] = useState("");
  const [editInterests, setEditInterests] = useState<string[]>([]);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => { getAuth().then(setUser); }, []);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api<ApiResponse<Senior>>(`/api/seniors/${user.id}`);
      if (res.data) {
        setSenior(res.data);
        setEditName(res.data.name);
        setEditPhone(res.data.phone);
        setEditAddress(res.data.address);
        setEditMobility(res.data.mobility_notes);
        setEditEmergency(res.data.emergency_contact);
        setEditInterests(res.data.interests || []);
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
      const res = await api<ApiResponse<Senior>>(`/api/seniors/${user?.id}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: value }),
      });
      if (res.error) {
        Alert.alert("Error", res.error);
      } else if (res.data) {
        setSenior(res.data);
        setEditingField(null);
      }
    } catch {
      Alert.alert("Error", "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  function toggleInterest(key: string) {
    const updated = editInterests.includes(key)
      ? editInterests.filter((k) => k !== key)
      : [...editInterests, key];
    setEditInterests(updated);
    saveField("interests", updated);
  }

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => { await clearAuth(); router.replace("/"); } },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} tintColor={colors.primary} />}
    >
      <Text style={styles.heading}>My{"\n"}<Text style={styles.headingAccent}>Profile</Text></Text>

      {senior && (
        <>
          <View style={styles.card}>
            <EditableRow label="Name" value={editName} isEditing={editingField === "name"} onEdit={() => { setEditingField("name"); setEditName(senior.name); }} onChangeText={setEditName} onSave={() => saveField("name", editName.trim())} onCancel={() => setEditingField(null)} saving={saving} />
            <EditableRow label="Phone" value={editPhone} isEditing={editingField === "phone"} onEdit={() => { setEditingField("phone"); setEditPhone(senior.phone); }} onChangeText={setEditPhone} onSave={() => saveField("phone", editPhone.trim())} onCancel={() => setEditingField(null)} saving={saving} keyboardType="phone-pad" />
            <EditableRow label="Address" value={editAddress} isEditing={editingField === "address"} onEdit={() => { setEditingField("address"); setEditAddress(senior.address); }} onChangeText={setEditAddress} onSave={() => saveField("address", editAddress.trim())} onCancel={() => setEditingField(null)} saving={saving} />
            <EditableRow label="Emergency" value={editEmergency} isEditing={editingField === "emergency_contact"} onEdit={() => { setEditingField("emergency_contact"); setEditEmergency(senior.emergency_contact); }} onChangeText={setEditEmergency} onSave={() => saveField("emergency_contact", editEmergency.trim())} onCancel={() => setEditingField(null)} saving={saving} />
            <EditableRow label="Mobility" value={editMobility} isEditing={editingField === "mobility_notes"} onEdit={() => { setEditingField("mobility_notes"); setEditMobility(senior.mobility_notes); }} onChangeText={setEditMobility} onSave={() => saveField("mobility_notes", editMobility.trim())} onCancel={() => setEditingField(null)} saving={saving} />
          </View>

          <View style={styles.card}>
            <View style={styles.interestHeader}>
              <Text style={styles.cardTitle}>Interests</Text>
              {saving && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            <View style={styles.chipGrid}>
              {INTERESTS.map((key) => {
                const selected = editInterests.includes(key);
                return (
                  <TouchableOpacity key={key} style={[styles.chip, selected && styles.chipSelected]} onPress={() => toggleInterest(key)}>
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                      {key.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
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
                    body: JSON.stringify({ role: "senior", id: user?.id, current_password: currentPw, new_password: newPw }),
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
      <Text style={styles.infoValue}>{value || "Not set"}</Text>
      <TouchableOpacity onPress={onEdit}><Text style={styles.editBtn}>Edit</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  heading: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.textPrimary, lineHeight: 40, marginBottom: spacing.lg },
  headingAccent: { color: colors.primary },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  cardTitle: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textPrimary, marginBottom: spacing.sm },
  interestHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary, width: 90 },
  infoValue: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary },
  editBtn: { fontSize: fontSize.sm, fontWeight: "600", color: colors.primary },
  editRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  editInput: { backgroundColor: colors.background, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: spacing.sm, paddingVertical: 10, fontSize: fontSize.md, color: colors.textPrimary, marginVertical: spacing.xs },
  editActions: { flexDirection: "row", gap: spacing.md, justifyContent: "flex-end" },
  saveText: { fontSize: fontSize.sm, fontWeight: "700", color: colors.primary },
  cancelText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  chipLabel: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textSecondary },
  chipLabelSelected: { color: colors.primary },
  signOutButton: { borderRadius: radius.pill, padding: spacing.md, alignItems: "center", marginTop: spacing.lg, borderWidth: 2, borderColor: colors.secondary, backgroundColor: colors.surface },
  signOutText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.secondary },
});
