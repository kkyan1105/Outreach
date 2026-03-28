import { Senior, Volunteer, OutingRequest, Outing } from "./types";

export const mockSeniors: Senior[] = [
  {
    id: "s1",
    name: "Alice Johnson",
    phone: "615-555-0101",
    address: "1000 Broadway, Nashville, TN",
    lat: 36.158,
    lng: -86.7816,
    interests: ["grocery", "church"],
    mobility_notes: "Uses a walker",
    emergency_contact: "Son: 615-555-9999",
    created_at: "2026-03-28T00:00:00Z",
  },
  {
    id: "s2",
    name: "Bob Williams",
    phone: "615-555-0102",
    address: "1200 West End Ave, Nashville, TN",
    lat: 36.151,
    lng: -86.798,
    interests: ["grocery", "library"],
    mobility_notes: "",
    emergency_contact: "",
    created_at: "2026-03-28T00:00:00Z",
  },
  {
    id: "s3",
    name: "Carol Davis",
    phone: "615-555-0103",
    address: "900 Rosa L Parks Blvd, Nashville, TN",
    lat: 36.1685,
    lng: -86.7903,
    interests: ["park", "museum"],
    mobility_notes: "Wheelchair accessible vehicle needed",
    emergency_contact: "Daughter: 615-555-8888",
    created_at: "2026-03-28T00:00:00Z",
  },
];

export const mockVolunteers: Volunteer[] = [
  {
    id: "v1",
    name: "David Chen",
    phone: "615-555-0201",
    address: "500 Church St, Nashville, TN",
    lat: 36.1627,
    lng: -86.7787,
    vehicle_type: "SUV",
    max_passengers: 4,
    availability: ["monday_morning", "wednesday_morning", "saturday_morning"],
    created_at: "2026-03-28T00:00:00Z",
  },
];

export const mockRequests: OutingRequest[] = [
  {
    id: "r1",
    senior_id: "s1",
    destination_type: "grocery",
    destination_name: "Kroger on 21st Ave",
    preferred_date: "2026-03-30",
    preferred_time_start: "09:00",
    preferred_time_end: "12:00",
    status: "pending",
    created_at: "2026-03-28T00:00:00Z",
  },
  {
    id: "r2",
    senior_id: "s2",
    destination_type: "grocery",
    destination_name: "Publix on Broadway",
    preferred_date: "2026-03-30",
    preferred_time_start: "10:00",
    preferred_time_end: "13:00",
    status: "pending",
    created_at: "2026-03-28T00:00:00Z",
  },
  {
    id: "r3",
    senior_id: "s3",
    destination_type: "park",
    destination_name: "Centennial Park",
    preferred_date: "2026-03-31",
    preferred_time_start: "14:00",
    preferred_time_end: "17:00",
    status: "pending",
    created_at: "2026-03-28T00:00:00Z",
  },
];

export const mockOutings: (Outing & { seniors: Senior[]; volunteer: Volunteer })[] = [
  {
    id: "o1",
    volunteer_id: "v1",
    request_ids: ["r1", "r2"],
    scheduled_date: "2026-03-30",
    scheduled_time: "10:00",
    destination_type: "grocery",
    route_info: {},
    status: "pending",
    created_at: "2026-03-28T00:00:00Z",
    seniors: [mockSeniors[0], mockSeniors[1]],
    volunteer: mockVolunteers[0],
  },
];
