// ====== Database Models ======

export interface Senior {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  interests: string[];
  emergency_contact_name: string;
  emergency_contact_phone: string;
  created_at: string;
}

export interface Volunteer {
  id: string;
  name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  vehicle_type: string;
  max_passengers: number;
  availability: string[];
  created_at: string;
}

export interface OutingRequest {
  id: string;
  senior_id: string;
  destination_type: string;
  destination_name: string;
  preferred_date: string;
  preferred_time_start: string;
  preferred_time_end: string;
  status: "pending" | "matched" | "completed" | "cancelled";
  created_at: string;
}

export interface Outing {
  id: string;
  volunteer_id: string;
  request_ids: string[];
  scheduled_date: string;
  scheduled_time: string;
  destination_type: string;
  route_info: object;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  created_at: string;
}

// ====== API Request / Response ======

export interface CreateSeniorRequest {
  name: string;
  phone: string;
  address: string;
  interests: string[];
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
}

export interface CreateVolunteerRequest {
  name: string;
  phone: string;
  address: string;
  vehicle_type: string;
  max_passengers: number;
  availability: string[];
}

export interface CreateOutingRequest {
  senior_id: string;
  destination_type: string;
  destination_name?: string;
  preferred_date: string;
  preferred_time_start: string;
  preferred_time_end: string;
}

export interface MatchResult {
  groups: {
    senior_ids: string[];
    volunteer_id: string;
    suggested_time: string;
    destination_type: string;
    reasoning: string;
  }[];
  unmatched_seniors: string[];
  unmatched_reason: string;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}
