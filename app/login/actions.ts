"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

function getValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export async function signUpAction(formData: FormData) {
  const email = getValue(formData, "email");
  const password = getValue(formData, "password");

  if (!email || !password) {
    redirect("/login?message=Podaj%20email%20i%20haslo");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    redirect("/private");
  }

  redirect("/login?message=Konto%20utworzone.%20Teraz%20sie%20zaloguj.");
}

export async function signInAction(formData: FormData) {
  const email = getValue(formData, "email");
  const password = getValue(formData, "password");

  if (!email || !password) {
    redirect("/login?message=Podaj%20email%20i%20haslo");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect("/private");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}