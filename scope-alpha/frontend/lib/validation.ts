// Input validation and sanitization utilities

// Strip HTML tags to prevent XSS
export function sanitizeText(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// Validate string length
export function validateLength(
  value: string,
  min: number,
  max: number,
  fieldName: string
): string | null {
  if (value.length < min) return `${fieldName} must be at least ${min} characters`;
  if (value.length > max) return `${fieldName} must be at most ${max} characters`;
  return null;
}

// Validate email format
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Validate price (positive number)
export function isValidPrice(price: number): boolean {
  return typeof price === "number" && price > 0 && price <= 1000000;
}

// Validate rating (1-5 integer)
export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

// Safe render text (for displaying user content)
export function safeRender(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Validate image upload
export function validateImageUpload(file: {
  size: number;
  type: string;
}): string | null {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

  if (file.size > MAX_SIZE) {
    return "Image must be smaller than 5MB";
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only JPEG, PNG, GIF, and WebP images are allowed";
  }
  return null;
}

// Consistent API error response format
export interface ApiError {
  error: string;
  code?: string;
  details?: Record<string, string>;
}

export function apiError(
  message: string,
  status: number,
  code?: string,
  details?: Record<string, string>
): Response {
  const body: ApiError = { error: message };
  if (code) body.code = code;
  if (details) body.details = details;

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
