import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function fetchTaskById(taskId) {
  const { data, error } = await supabase
    .from("quicktasks")
    .select("title")
    .eq("id", taskId)
    .single();
  if (error) throw error;
  return data?.title || "Unknown Task";
}

export async function fetchAllTasks() {
  const { data, error } = await supabase
    .from("quicktasks")
    .select("*")
    .order("order", { ascending: true });
  if (error) throw error;
  return data || [];
}
