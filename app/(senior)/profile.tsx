import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, StyleSheet, TextInput,
  TouchableOpacity, ActivityIndicator, RefreshControl, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import { getAuth, clearAuth } from "../../lib/auth";
import type { AuthUser } from "../../lib/auth";
import type { ApiResponse, Senior } from "../../lib/types";


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
  const [editEmergencyName, setEditEmergencyName] = useState("");
  const [editEmergencyPhone, setEditEmergencyPhone] = useState("");

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
        setEditEmergencyName(res.data.emergency_contact_name);
        setEditEmergencyPhone(res.data.emergency_contact_phone);
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
          {/* Personal Info */}
          <Text style={styles.sectionLabel}>Personal Info</Text>
          <View style={styles.card}>
            <EditableRow label="Name" value={editName} fieldKey="name" editingField={editingField} setEditingField={setEditingField} onChangeText={setEditName} onSave={() => saveField("name", editName.trim())} saving={saving} />
            <EditableRow label="Phone" value={editPhone} fieldKey="phone" editingField={editingField} setEditingField={setEditingField} onChangeText={setEditPhone} onSave={() => saveField("phone", editPhone.trim())} saving={saving} keyboardType="phone-pad" />
            <EditableRow label="Address" value={editAddress} fieldKey="address" editingField={editingField} setEditingField={setEditingField} onChangeText={setEditAddress} onSave={() => saveField("address", editAddress.trim())} saving={saving} last />
          </View>

          {/* Emergency Contact */}
          <Text style={styles.sectionLabel}>Emergency Contact</Text>
          <View style={styles.card}>
            <EditableRow label="Contact Name" value={editEmergencyName} fieldKey="emergency_contact_name" editingField={editingField} setEditingField={setEditingField} onChangeText={setEditEmergencyName} onSave={() => saveField("emergency_contact_name", editEmergencyName.trim())} saving={saving} />
            <EditableRow label="Contact Phone" value={editEmergencyPhone} fieldKey="emergency_contact_phone" editingField={editingField} setEditingField={setEditingField} onChangeText={setEditEmergencyPhone} onSave={() => saveField("emergency_contact_phone", editEmergencyPhone.trim())} saving={saving} keyboardType="phone-pad" last />
          </View>

        </>
      )}

      {/* Security */}
      <Text style={styles.sectionLabel}>Security</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.passwordToggle} onPress={() => setShowChangePassword(!showChangePassword)}>
          <Ionicons name="lock-closed-outline" size={22} color={colors.textPrimary} />
          <Text style={styles.passwordToggleText}>Change Password</Text>
          <Ionicons name={showChangePassword ? "chevron-up" : "chevron-down"} size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        {showChangePassword && (
          <View style={styles.passwordForm}>
            <TextInput style={styles.editInput} placeholder="Current password" placeholderTextColor={colors.textSecondary} secureTextEntry value={currentPw} onChangeText={setCurrentPw} />
            <TextInput style={styles.editInput} placeholder="New password (min 6 chars)" placeholderTextColor={colors.textSecondary} secureTextEntry value={newPw} onChangeText={setNewPw} />
            <TouchableOpacity
              style={styles.savePwBtn}
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
              <Text style={styles.savePwBtnText}>{pwLoading ? "Saving…" : "Update Password"}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out-outline" size={20} color={colors.secondary} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function EditableRow({ label, value, fieldKey, editingField, setEditingField, onChangeText, onSave, saving, keyboardType, last }: {
  label: string;
  value: string;
  fieldKey: string;
  editingField: string | null;
  setEditingField: (f: string | null) => void;
  onChangeText: (t: string) => void;
  onSave: () => void;
  saving: boolean;
  keyboardType?: "default" | "phone-pad";
  last?: boolean;
}) {
  const isEditing = editingField === fieldKey;
  return (
    <View style={[styles.fieldRow, last && styles.lastRow]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {isEditing ? (
        <>
          <TextInput
            style={styles.editInput}
            value={value}
            onChangeText={onChangeText}
            autoFocus
            keyboardType={keyboardType || "default"}
          />
          <View style={styles.editActions}>
            <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingField(null)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={styles.fieldValueRow}>
          <Text style={styles.fieldValue}>{value || "Not set"}</Text>
          <TouchableOpacity style={styles.editIconBtn} onPress={() => setEditingField(fieldKey)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="pencil" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background },
  heading: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.textPrimary, lineHeight: 40, marginBottom: spacing.lg },
  headingAccent: { color: colors.primary },
  sectionLabel: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  fieldRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastRow: { borderBottomWidth: 0 },
  fieldLabel: {
    fontSize: fontSize.xs,
    fontWeight: "700",
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldValue: {
    fontSize: fontSize.lg,
    fontWeight: "500",
    color: colors.textPrimary,
    flex: 1,
  },
  editIconBtn: { padding: 4 },
  editInput: {
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    marginTop: 4,
  },
  editActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: { fontSize: fontSize.md, fontWeight: "700", color: "#fff" },
  cancelBtn: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cancelBtnText: { fontSize: fontSize.md, fontWeight: "600", color: colors.textSecondary },
  passwordToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  passwordToggleText: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  passwordForm: { paddingBottom: spacing.md },
  savePwBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  savePwBtnText: { fontSize: fontSize.md, fontWeight: "700", color: "#fff" },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 2,
    borderColor: colors.secondary,
    backgroundColor: colors.surface,
  },
  signOutText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.secondary },
});
