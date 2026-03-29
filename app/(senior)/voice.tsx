import { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, ActivityIndicator,
  ScrollView, Pressable, Alert, Modal, TouchableOpacity,
} from "react-native";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { useRouter, useFocusEffect } from "expo-router";
import { colors, fontSize, radius, spacing } from "../../lib/theme";
import { api } from "../../lib/api";
import { getAuth } from "../../lib/auth";
import type { ApiResponse, OutingRequest } from "../../lib/types";

const OPENAI_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || "";
const GOOGLE_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const SEARCH_RADIUS_METERS = 8000;

const GROCERY_CHAIN_KEYWORDS = [
  "walmart", "target", "costco", "kroger", "publix", "albertsons",
  "safeway", "whole foods", "trader joe's", "trader joes", "aldi",
  "lidl", "sprouts", "harris teeter", "meijer", "wegmans", "food lion",
  "giant", "shoprite", "winco", "ingles", "sam's club",
];

const TIME_SLOTS = [
  { key: "morning",   label: "Morning",   start: "09:00", end: "12:00" },
  { key: "afternoon", label: "Afternoon", start: "12:00", end: "16:00" },
  { key: "evening",   label: "Evening",   start: "16:00", end: "19:00" },
];

type Step = "destination_type" | "specific_place" | "confirm_place" | "date" | "time_slot" | "confirm";
type Phase = "idle" | "speaking" | "listening" | "processing" | "submitting";

interface Message { role: "ai" | "user"; text: string; }
interface Collected {
  destinationType: string;
  destinationName: string;
  preferredDate: string;
  timeSlotKey: string;
}

function getTodayStr() { return new Date().toISOString().split("T")[0]; }
function getTomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function getQuestion(step: Step, ctx: { destinationType?: string; nearbyGroceries?: string[] }): string {
  if (step === "destination_type")
    return "Where would you like to go? You can say: Grocery Store, Pharmacy, Church, or Park.";
  if (step === "specific_place") {
    if (ctx.destinationType === "grocery") {
      const stores = ctx.nearbyGroceries?.length ? ctx.nearbyGroceries.join(", ") : "Kroger or Walmart";
      return `Which grocery store? Near you we have: ${stores}. You can name one or more, or say "any" if you're flexible.`;
    }
    if (ctx.destinationType === "pharmacy")
      return `Which pharmacy? For example: CVS, Walgreens, or Walmart. You can name more than one, or say "any".`;
    if (ctx.destinationType === "church")
      return "Which church would you like to go to? Or say \"any\" if you're flexible.";
    return `Do you have a specific park in mind? Or say "any" if you're flexible.`;
  }
  if (step === "date")
    return "Which day would you like to go? You can say Today, Tomorrow, or a day of the week like Monday.";
  if (step === "time_slot")
    return "What time works best? Morning is 9am to noon, Afternoon is noon to 4pm, or Evening is 4pm to 7pm.";
  return "";
}

function buildSystemPrompt(step: Step, ctx: {
  destinationType?: string;
  nearbyGroceries?: string[];
  today: string;
  tomorrow: string;
}): string {
  const base = `You are a friendly voice assistant helping seniors book group outings.
Today is ${ctx.today}. Tomorrow is ${ctx.tomorrow}.
Respond ONLY with valid JSON: {"understood": boolean, "value": string | null, "response": string}
Keep "response" short (1-2 sentences), warm, and clear for elderly users.

BEFORE step-specific logic, check these global commands:
1. Go back ("go back", "previous question", "wait go back", "redo that", "last one"): value = "__BACK__", understood = true, response = "Sure, going back!"
2. Start over ("start over", "restart", "begin again", "from the beginning", "let's redo this"): value = "__RESTART__", understood = true, response = "Sure, let's start from the beginning!"
3. If the user's message is completely unrelated to the current question (e.g. "I will do homework", "what's the weather", random sentences with no booking intent): understood = false, response = "I'm not sure I understood that. [restate the current question in one short sentence]."`;


  const steps: Record<Step, string> = {
    destination_type: `Step: identify destination type.
Valid values: "grocery", "pharmacy", "church", "park".
Accept natural speech like "grocery store", "the pharmacy", "my church", "a park".
If understood: response = "Got it! [echo their choice]."
If not: politely list the 4 options again.`,

    specific_place: ctx.destinationType === "grocery"
      ? `Step: identify specific grocery store.
Supported nearby stores: ${ctx.nearbyGroceries?.join(", ") || "Kroger, Walmart"}.
Fuzzy match (e.g. "Kroger on main" → "Kroger").
If they say "any", "doesn't matter", "flexible": value = "Any", understood = true.
If they name an UNSUPPORTED store: understood = false, response names the supported stores near them.`
      : ctx.destinationType === "pharmacy"
      ? `Step: identify pharmacy chain(s).
Valid: CVS Pharmacy, Walgreens, Walmart Pharmacy, Kroger Pharmacy, Publix Pharmacy.
Accept multiple (e.g. "CVS or Walgreens" → "CVS Pharmacy, Walgreens").
If they say "any": value = "Any", understood = true.`
      : `Step: identify specific ${ctx.destinationType || "place"}.
Accept any name. If they say "any", "doesn't matter", "flexible": value = "Any".
Otherwise value = the name they said.`,

    date: `Step: extract date as YYYY-MM-DD.
Today=${ctx.today}, Tomorrow=${ctx.tomorrow}.
"This Monday/Tuesday/etc" = nearest upcoming day. "This weekend" = nearest Saturday.
Common speech: "next week Monday", "in two days", "Saturday". Convert all to YYYY-MM-DD.`,

    time_slot: `Step: extract time preference.
Valid values (use exactly): "morning", "afternoon", "evening".
"morning"=9am-noon, "afternoon"=noon-4pm, "evening"=4pm-7pm.
"early" or "in the morning" → "morning". "midday" or "lunchtime" → "afternoon". "later" or "evening" → "evening".`,

    confirm_place: `Step: user is confirming whether the place we found is correct.
"yes", "correct", "that's right", "right", "yep", "yeah", "sure" → value = "yes", understood = true.
"no", "wrong", "that's not it", "different", "not that one" → value = "no", understood = true.`,

    confirm: `Step: user is confirming or rejecting the booking summary.
"yes", "correct", "sounds good", "that's right", "perfect" → value = "yes", understood = true.
"no", "change", "wrong", "that's not right" → value = "no", understood = true.`,
  };

  return `${base}\n\n${steps[step]}`;
}

export default function VoiceRequestScreen() {
  const router = useRouter();
  const [seniorId, setSeniorId] = useState<string | null>(null);
  const [seniorLat, setSeniorLat] = useState<number | null>(null);
  const [seniorLng, setSeniorLng] = useState<number | null>(null);
  const [nearbyGroceries, setNearbyGroceries] = useState<string[]>([]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState<Step>("destination_type");
  const [showFormModal, setShowFormModal] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [collected, setCollected] = useState<Partial<Collected>>({});

  const recordingRef = useRef<Audio.Recording | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const retryRef = useRef(0);
  const completedRef = useRef(false);
  const hasStartedRef = useRef(false);
  const stepRef = useRef<Step>("destination_type");
  const collectedRef = useRef<Partial<Collected>>({});
  const nearbyGroceriesRef = useRef<string[]>([]);

  useEffect(() => {
    getAuth().then(async (user) => {
      if (!user) return;
      setSeniorId(user.id);
      try {
        const res = await api<ApiResponse<any>>(`/api/seniors?id=${user.id}`);
        const senior = res.data?.[0];
        if (senior?.lat) { setSeniorLat(senior.lat); setSeniorLng(senior.lng); }
      } catch {}
    });
  }, []);

  useEffect(() => {
    if (!seniorLat || !seniorLng || !GOOGLE_KEY) return;
    fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${seniorLat},${seniorLng}&radius=${SEARCH_RADIUS_METERS}&type=supermarket&key=${GOOGLE_KEY}`)
      .then((r) => r.json())
      .then((json) => {
        const seen = new Set<string>();
        const chains: string[] = [];
        for (const place of (json.results || [])) {
          const lower = place.name.toLowerCase();
          for (const kw of GROCERY_CHAIN_KEYWORDS) {
            if (lower.includes(kw) && !seen.has(kw)) {
              seen.add(kw);
              chains.push(place.name);
              break;
            }
          }
        }
        setNearbyGroceries(chains.slice(0, 5));
      })
      .catch(() => {});
  }, [seniorLat, seniorLng]);

  // Keep refs in sync so useFocusEffect can read latest values without deps
  stepRef.current = step;
  collectedRef.current = collected;
  nearbyGroceriesRef.current = nearbyGroceries;

  const addMessage = useCallback((role: "ai" | "user", text: string) => {
    setMessages((prev) => [...prev, { role, text }]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const speak = useCallback((text: string, onDone?: () => void) => {
    setPhase("speaking");
    Speech.stop();
    Speech.speak(text, {
      language: "en-US",
      rate: 0.85,
      pitch: 1.0,
      onDone: () => { onDone?.(); },
      onError: () => { onDone?.(); },
    });
  }, []);

  useFocusEffect(useCallback(() => {
    setPhase("idle");
    Speech.stop();
    const shouldStart = !hasStartedRef.current || completedRef.current;
    if (shouldStart) {
      hasStartedRef.current = true;
      completedRef.current = false;
      setStep("destination_type");
      setCollected({});
      setShowFormModal(false);
      retryRef.current = 0;
      const timer = setTimeout(() => {
        const q = getQuestion("destination_type", {});
        setMessages((prev) => [...prev, { role: "ai" as const, text: q }]);
        speak(q, () => setPhase("idle"));
      }, 600);
      return () => { clearTimeout(timer); Speech.stop(); };
    }
    // Resuming: re-speak the current step's question
    const timer = setTimeout(() => {
      const q = getQuestion(stepRef.current, {
        destinationType: collectedRef.current.destinationType,
        nearbyGroceries: nearbyGroceriesRef.current,
      });
      if (q) speak(q, () => setPhase("idle"));
    }, 600);
    return () => { clearTimeout(timer); Speech.stop(); };
  }, [speak]));

  async function startRecording() {
    if (phase === "speaking") Speech.stop();
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow microphone access.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setPhase("listening");
    } catch {
      Alert.alert("Error", "Could not access microphone.");
    }
  }

  async function stopRecording() {
    if (!recordingRef.current) return;
    setPhase("processing");
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri) await processAudio(uri);
      else handleNotUnderstood(step);
    } catch {
      handleNotUnderstood(step);
    }
  }

  async function processAudio(uri: string) {
    if (!OPENAI_KEY) {
      Alert.alert("Missing Key", "Add EXPO_PUBLIC_OPENAI_API_KEY to .env.local");
      setPhase("idle");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", { uri, type: "audio/m4a", name: "recording.m4a" } as any);
      formData.append("model", "whisper-1");
      formData.append("language", "en");
      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}` },
        body: formData,
      });
      const whisperJson = await whisperRes.json();
      if (!whisperRes.ok) {
        console.error("Whisper error:", JSON.stringify(whisperJson));
        Alert.alert("Whisper error", whisperJson?.error?.message || `HTTP ${whisperRes.status}`);
        handleNotUnderstood(step);
        return;
      }
      const { text } = whisperJson;
      if (!text?.trim()) {
        console.warn("Whisper returned empty text");
        handleNotUnderstood(step);
        return;
      }
      addMessage("user", text);
      await processTranscript(text, step, { ...collected });
    } catch (e) {
      console.error("processAudio exception:", e);
      handleNotUnderstood(step);
    }
  }

  async function processTranscript(text: string, currentStep: Step, currentCollected: Partial<Collected>) {
    const systemPrompt = buildSystemPrompt(currentStep, {
      destinationType: currentCollected.destinationType,
      nearbyGroceries,
      today: getTodayStr(),
      tomorrow: getTomorrowStr(),
    });
    try {
      const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
        }),
      });
      const gptData = await gptRes.json();
      if (!gptRes.ok) {
        console.error("GPT error:", JSON.stringify(gptData));
        Alert.alert("GPT error", gptData?.error?.message || `HTTP ${gptRes.status}`);
        handleNotUnderstood(currentStep);
        return;
      }
      const result = JSON.parse(gptData.choices[0].message.content);

      if (result.understood && result.value) {
        retryRef.current = 0;
        if (result.value === "__RESTART__") {
          addMessage("ai", result.response);
          speak(result.response, () => handleRestart());
          return;
        }
        if (result.value === "__BACK__") {
          addMessage("ai", result.response);
          speak(result.response, () => handleGoBack(currentStep, currentCollected));
          return;
        }
        // For steps that immediately ask the next question, skip GPT's filler response
        // and go straight to advanceStep to avoid two consecutive spoken sentences.
        const skipResponse = currentStep === "date" || currentStep === "time_slot" || currentStep === "specific_place" || currentStep === "confirm_place";
        if (skipResponse) {
          advanceStep(currentStep, result.value, currentCollected);
        } else {
          addMessage("ai", result.response);
          speak(result.response, () => advanceStep(currentStep, result.value, currentCollected));
        }
      } else {
        retryRef.current += 1;
        if (retryRef.current >= 3) {
          const msg = "I'm having trouble understanding. Would you like to switch to the regular form?";
          addMessage("ai", msg);
          setShowFormModal(true);
          speak(msg);
        } else {
          addMessage("ai", result.response);
          speak(result.response, () => setPhase("idle"));
        }
      }
    } catch (e) {
      console.error("processTranscript exception:", e);
      handleNotUnderstood(currentStep);
    }
  }

  function handleNotUnderstood(_currentStep: Step) {
    retryRef.current += 1;
    if (retryRef.current >= 3) {
      const msg = "I'm having trouble understanding. Would you like to switch to the regular form?";
      addMessage("ai", msg);
      setShowFormModal(true);
      speak(msg);
    } else {
      const msg = "Sorry, I didn't catch that. Please try again.";
      addMessage("ai", msg);
      speak(msg, () => setPhase("idle"));
    }
  }

function handleRestart() {
    retryRef.current = 0;
    setCollected({});
    setStep("destination_type");
    const q = getQuestion("destination_type", {});
    addMessage("ai", q);
    speak(q, () => setPhase("idle"));
  }

  function handleGoBack(currentStep: Step, currentCollected: Partial<Collected>) {
    retryRef.current = 0;
    if (currentStep === "destination_type") {
      const q = "We're already at the first question! " + getQuestion("destination_type", {});
      addMessage("ai", q);
      speak(q, () => setPhase("idle"));
    } else if (currentStep === "specific_place") {
      setStep("destination_type");
      const q = getQuestion("destination_type", {});
      addMessage("ai", q);
      speak(q, () => setPhase("idle"));
    } else if (currentStep === "confirm_place") {
      setStep("specific_place");
      const q = getQuestion("specific_place", { destinationType: currentCollected.destinationType, nearbyGroceries });
      addMessage("ai", q);
      speak(q, () => setPhase("idle"));
    } else if (currentStep === "date") {
      setStep("specific_place");
      const q = getQuestion("specific_place", { destinationType: currentCollected.destinationType, nearbyGroceries });
      addMessage("ai", q);
      speak(q, () => setPhase("idle"));
    } else if (currentStep === "time_slot") {
      setStep("date");
      const q = getQuestion("date", {});
      addMessage("ai", q);
      speak(q, () => setPhase("idle"));
    } else if (currentStep === "confirm") {
      setStep("time_slot");
      const q = getQuestion("time_slot", {});
      addMessage("ai", q);
      speak(q, () => setPhase("idle"));
    }
  }

  async function advanceStep(currentStep: Step, value: string, currentCollected: Partial<Collected>) {
    const next = { ...currentCollected };

    if (currentStep === "destination_type") {
      next.destinationType = value;
      setCollected(next);
      setStep("specific_place");
      const q = getQuestion("specific_place", { destinationType: value, nearbyGroceries });
      addMessage("ai", q);
      speak(q, () => setPhase("idle"));

    } else if (currentStep === "specific_place") {
      const needsConfirm = (currentCollected.destinationType === "church" || currentCollected.destinationType === "park") && value !== "Any";
      if (needsConfirm && seniorLat && seniorLng && GOOGLE_KEY) {
        setPhase("processing");
        try {
          const query = encodeURIComponent(`${value} ${currentCollected.destinationType}`);
          const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&location=${seniorLat},${seniorLng}&radius=${SEARCH_RADIUS_METERS}&key=${GOOGLE_KEY}`;
          const r = await fetch(url);
          const json = await r.json();
          const place = json.results?.[0];
          if (place) {
            next.destinationName = place.name;
            setCollected(next);
            setStep("confirm_place");
            const q = `I found "${place.name}" at ${place.formatted_address}. Is that the right one?`;
            addMessage("ai", q);
            speak(q, () => setPhase("idle"));
            return;
          }
        } catch (e) {
          console.error("Place search error:", e);
        }
      }
      next.destinationName = value;
      setCollected(next);
      setStep("date");
      const q = getQuestion("date", {});
      addMessage("ai", q);
      speak(q, () => setPhase("idle"));

    } else if (currentStep === "confirm_place") {
      if (value === "yes") {
        setStep("date");
        const q = getQuestion("date", {});
        addMessage("ai", q);
        speak(q, () => setPhase("idle"));
      } else {
        setStep("specific_place");
        retryRef.current = 0;
        const q = `No problem! ` + getQuestion("specific_place", { destinationType: next.destinationType, nearbyGroceries });
        addMessage("ai", q);
        speak(q, () => setPhase("idle"));
      }

    } else if (currentStep === "date") {
      next.preferredDate = value;
      setCollected(next);
      setStep("time_slot");
      const q = getQuestion("time_slot", {});
      addMessage("ai", q);
      speak(q, () => setPhase("idle"));

    } else if (currentStep === "time_slot") {
      next.timeSlotKey = value;
      setCollected(next);
      setStep("confirm");
      const slot = TIME_SLOTS.find((t) => t.key === value);
      const today = getTodayStr();
      const tomorrow = getTomorrowStr();
      const dateLabel = next.preferredDate === today ? "today"
        : next.preferredDate === tomorrow ? "tomorrow"
        : `on ${new Date(next.preferredDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`;
      const dest = next.destinationName && next.destinationName !== "Any"
        ? next.destinationName
        : `a ${next.destinationType}`;
      const confirm = `Perfect! You'd like to go to ${dest} ${dateLabel} in the ${slot?.label.toLowerCase() || value}. Is that correct?`;
      addMessage("ai", confirm);
      speak(confirm, () => setPhase("idle"));

    } else if (currentStep === "confirm") {
      if (value === "yes") {
        submitRequest(next as Collected);
      } else {
        const msg = "No problem! Let's start over. Where would you like to go?";
        setCollected({});
        setStep("destination_type");
        retryRef.current = 0;
        addMessage("ai", msg);
        speak(msg, () => setPhase("idle"));
      }
    }
  }

  async function submitRequest(data: Collected) {
    if (!seniorId) { Alert.alert("Error", "No profile found."); return; }
    setPhase("submitting");
    const slot = TIME_SLOTS.find((t) => t.key === data.timeSlotKey) || TIME_SLOTS[0];
    try {
      const res = await api<ApiResponse<OutingRequest>>("/api/requests", {
        method: "POST",
        body: JSON.stringify({
          senior_id: seniorId,
          destination_type: data.destinationType,
          destination_name: data.destinationName === "Any" ? null : data.destinationName,
          preferred_date: data.preferredDate,
          preferred_time_start: slot.start,
          preferred_time_end: slot.end,
        }),
      });
      if (res.error) {
        Alert.alert("Error", res.error);
        setPhase("idle");
      } else {
        const msg = "Your request has been submitted! We'll find a group for you soon.";
        addMessage("ai", msg);
        completedRef.current = true;
        speak(msg, () => router.replace("/(senior)/status"));
      }
    } catch {
      Alert.alert("Error", "Could not submit. Please try again.");
      setPhase("idle");
    }
  }

  const stepLabels: Record<Step, string> = {
    destination_type: "Step 1 of 4 — Destination",
    specific_place:   "Step 2 of 4 — Location",
    confirm_place:    "Step 2 of 4 — Confirm Location",
    date:             "Step 3 of 4 — Date",
    time_slot:        "Step 4 of 4 — Time",
    confirm:          "Almost done — Confirming",
  };

  const isListening  = phase === "listening";
  const isProcessing = phase === "processing" || phase === "submitting";
  const isSpeaking   = phase === "speaking";
  const canPress     = !isProcessing;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎙️ Talk & Ride</Text>
        <Text style={styles.stepLabel}>{stepLabels[step]}</Text>
      </View>

      <ScrollView ref={scrollRef} style={styles.chat} contentContainerStyle={styles.chatContent}>
        {messages.map((msg, i) => (
          <View key={i} style={[styles.bubble, msg.role === "ai" ? styles.aiBubble : styles.userBubble]}>
            <Text style={[styles.bubbleText, msg.role === "user" && styles.userBubbleText]}>
              {msg.text}
            </Text>
          </View>
        ))}
        {isProcessing && (
          <View style={[styles.bubble, styles.aiBubble]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
      </ScrollView>

      <View style={styles.micArea}>
        <Text style={styles.statusText}>
          {isSpeaking ? "🔊  Speaking…"
            : isListening  ? "🎙️  Listening…"
            : isProcessing ? "⏳  Processing…"
            : "Ready"}
        </Text>

        <Pressable
          onPressIn={startRecording}
          onPressOut={stopRecording}
          disabled={!canPress}
          style={({ pressed }) => [
            styles.micButton,
            isListening  && styles.micButtonListening,
            isProcessing && styles.micButtonDisabled,
            pressed      && styles.micButtonPressed,
          ]}
        >
          <Text style={styles.micEmoji}>{isListening ? "🔴" : "🎙️"}</Text>
        </Pressable>

        <Text style={styles.pushLabel}>
          {isListening ? "Release to send" : "PUSH TO TALK"}
        </Text>
      </View>

      <Modal visible={showFormModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalEmoji}>📝</Text>
            <Text style={styles.modalTitle}>Switch to Regular Form?</Text>
            <Text style={styles.modalBody}>
              Having trouble with voice? You can fill out the form by hand instead.
            </Text>
            <TouchableOpacity
              style={styles.modalBtnPrimary}
              onPress={() => { setShowFormModal(false); router.replace("/(senior)/request"); }}
            >
              <Text style={styles.modalBtnPrimaryText}>Yes, take me there</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnSecondary}
              onPress={() => {
                setShowFormModal(false);
                retryRef.current = 0;
                setStep("destination_type");
                setCollected({});
                const q = "No problem! Let's try again. Where would you like to go?";
                addMessage("ai", q);
                speak(q, () => setPhase("idle"));
              }}
            >
              <Text style={styles.modalBtnSecondaryText}>No, let me try again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 60, paddingHorizontal: spacing.lg, paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: fontSize.xl, fontWeight: "800", color: colors.textPrimary },
  stepLabel: { fontSize: fontSize.sm, color: colors.primary, fontWeight: "600", marginTop: 4 },
  chat: { flex: 1 },
  chatContent: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  bubble: {
    maxWidth: "80%", borderRadius: radius.md,
    padding: spacing.md,
  },
  aiBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: colors.primary,
  },
  bubbleText: { fontSize: fontSize.md, color: colors.textPrimary, lineHeight: 24 },
  userBubbleText: { color: "#fff" },
  micArea: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingBottom: 40,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
    gap: spacing.md,
  },
  statusText: {
    fontSize: fontSize.md, color: colors.textSecondary, fontWeight: "600",
    height: 24,
  },
  micButton: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: colors.primary,
    justifyContent: "center", alignItems: "center",
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  micButtonListening: {
    backgroundColor: "#E53935",
    shadowColor: "#E53935",
    transform: [{ scale: 1.08 }],
  },
  micButtonDisabled: { backgroundColor: colors.border, shadowOpacity: 0 },
  micButtonPressed: { transform: [{ scale: 0.95 }] },
  micEmoji: { fontSize: 52 },
  pushLabel: {
    fontSize: fontSize.lg, fontWeight: "800",
    color: colors.textSecondary, letterSpacing: 1.5,
  },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center",
    padding: spacing.lg,
  },
  modalBox: {
    backgroundColor: colors.background, borderRadius: radius.lg,
    padding: spacing.xl, width: "100%", alignItems: "center", gap: spacing.md,
  },
  modalEmoji: { fontSize: 52 },
  modalTitle: {
    fontSize: fontSize.xxl, fontWeight: "800",
    color: colors.textPrimary, textAlign: "center",
  },
  modalBody: {
    fontSize: fontSize.lg, color: colors.textSecondary,
    textAlign: "center", lineHeight: 28,
  },
  modalBtnPrimary: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 18, width: "100%", alignItems: "center",
    marginTop: spacing.sm,
  },
  modalBtnPrimaryText: { fontSize: fontSize.lg, fontWeight: "800", color: "#fff" },
  modalBtnSecondary: {
    borderWidth: 2, borderColor: colors.border, borderRadius: radius.pill,
    paddingVertical: 18, width: "100%", alignItems: "center",
  },
  modalBtnSecondaryText: { fontSize: fontSize.lg, fontWeight: "700", color: colors.textSecondary },
});
