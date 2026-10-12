export interface StudentAccommodationPreferences {
  budget: string;
  room_type: string;
  accessible: boolean;
  distance_km: string;
}

export const STUDENT_PREFERENCES_KEY = "student-haven-accommodation-preferences";
export const STUDENT_ONBOARDING_STEP_KEY = "student-haven-onboarding-step";

export const DEFAULT_STUDENT_PREFERENCES: StudentAccommodationPreferences = {
  budget: "",
  room_type: "",
  accessible: false,
  distance_km: "",
};

export function readStudentPreferences(): StudentAccommodationPreferences {
  try {
    const stored = localStorage.getItem(STUDENT_PREFERENCES_KEY);
    if (!stored) return DEFAULT_STUDENT_PREFERENCES;
    const value = JSON.parse(stored) as Partial<StudentAccommodationPreferences>;
    return {
      budget: typeof value.budget === "string" ? value.budget : "",
      room_type: typeof value.room_type === "string" ? value.room_type : "",
      accessible: value.accessible === true,
      distance_km: typeof value.distance_km === "string" ? value.distance_km : "",
    };
  } catch {
    return DEFAULT_STUDENT_PREFERENCES;
  }
}

export function normalizeStudentPreferences(value: unknown): StudentAccommodationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_STUDENT_PREFERENCES;
  }
  const stored = value as Partial<Record<keyof StudentAccommodationPreferences, unknown>>;
  return {
    budget: typeof stored.budget === "number" || typeof stored.budget === "string" ? String(stored.budget) : "",
    room_type: typeof stored.room_type === "string" ? stored.room_type : "",
    accessible: stored.accessible === true,
    distance_km: typeof stored.distance_km === "number" || typeof stored.distance_km === "string" ? String(stored.distance_km) : "",
  };
}

export function saveStudentPreferences(preferences: StudentAccommodationPreferences) {
  try {
    localStorage.setItem(STUDENT_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // Preferences remain in the current page state when browser storage is unavailable.
  }
}

export function readOnboardingStep(): number {
  try {
    const step = Number(localStorage.getItem(STUDENT_ONBOARDING_STEP_KEY));
    return Number.isInteger(step) && step >= 1 && step <= 5 ? step : 1;
  } catch {
    return 1;
  }
}

export function saveOnboardingStep(step: number) {
  try {
    localStorage.setItem(STUDENT_ONBOARDING_STEP_KEY, String(step));
  } catch {
    // The current page can still continue when browser storage is unavailable.
  }
}
