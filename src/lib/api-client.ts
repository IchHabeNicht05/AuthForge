"use client";

export class ApiError extends Error {
  status: number;
  issues?: Record<string, string[] | undefined>;

  constructor(message: string, status: number, issues?: Record<string, string[] | undefined>) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(data.error ?? "Something went wrong.", res.status, data.issues);
  }

  return data as T;
}
