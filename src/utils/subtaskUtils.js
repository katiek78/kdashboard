import supabase from "./supabaseClient";

/**
 * Fetch all subtasks for a given parent task ID
 * @param {number} parentTaskId - The ID of the parent task
 * @returns {Promise<Array>} Array of subtasks ordered by their order field
 */
export async function fetchSubtasks(parentTaskId) {
  const { data, error } = await supabase
    .from("subtasks")
    .select("*")
    .eq("parent_task_id", parentTaskId)
    .order("order", { ascending: true });

  if (error) {
    console.error("Error fetching subtasks:", error);
    return [];
  }

  return data || [];
}

/**
 * Create a new subtask
 * @param {number} parentTaskId - The ID of the parent task
 * @param {string} title - The title of the subtask
 * @returns {Promise<Object|null>} The created subtask or null if error
 */
export async function createSubtask(parentTaskId, title) {
  if (!title?.trim()) {
    console.error("Subtask title is required");
    return null;
  }

  // Get the current max order for this parent task
  const { data: existingSubtasks } = await supabase
    .from("subtasks")
    .select("order")
    .eq("parent_task_id", parentTaskId)
    .order("order", { ascending: false })
    .limit(1);

  const nextOrder = existingSubtasks?.[0]?.order
    ? existingSubtasks[0].order + 1
    : 1;

  const { data, error } = await supabase
    .from("subtasks")
    .insert([
      {
        parent_task_id: parentTaskId,
        title: title.trim(),
        order: nextOrder,
        completed: false,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating subtask:", error);
    return null;
  }

  return data;
}

/**
 * Update a subtask
 * @param {number} subtaskId - The ID of the subtask to update
 * @param {Object} updates - Object containing fields to update
 * @returns {Promise<Object|null>} The updated subtask or null if error
 */
export async function updateSubtask(subtaskId, updates) {
  const { data, error } = await supabase
    .from("subtasks")
    .update(updates)
    .eq("id", subtaskId)
    .select()
    .single();

  if (error) {
    console.error("Error updating subtask:", error);
    return null;
  }

  return data;
}

/**
 * Delete a subtask
 * @param {number} subtaskId - The ID of the subtask to delete
 * @returns {Promise<boolean>} True if successful, false if error
 */
export async function deleteSubtask(subtaskId) {
  const { error } = await supabase
    .from("subtasks")
    .delete()
    .eq("id", subtaskId);

  if (error) {
    console.error("Error deleting subtask:", error);
    return false;
  }

  return true;
}

/**
 * Toggle the completed status of a subtask
 * @param {number} subtaskId - The ID of the subtask
 * @param {boolean} completed - The new completed status
 * @returns {Promise<Object|null>} The updated subtask or null if error
 */
export async function toggleSubtaskCompleted(subtaskId, completed) {
  return updateSubtask(subtaskId, { completed });
}

/**
 * Reorder subtasks within a parent task
 * @param {number} parentTaskId - The ID of the parent task
 * @param {Array} subtaskIds - Array of subtask IDs in the new order
 * @returns {Promise<boolean>} True if successful, false if error
 */
export async function reorderSubtasks(parentTaskId, subtaskIds) {
  try {
    // Update each subtask with its new order
    const updates = subtaskIds.map(
      (subtaskId, index) =>
        supabase
          .from("subtasks")
          .update({ order: index + 1 })
          .eq("id", subtaskId)
          .eq("parent_task_id", parentTaskId) // Extra safety check
    );

    await Promise.all(updates);
    return true;
  } catch (error) {
    console.error("Error reordering subtasks:", error);
    return false;
  }
}

/**
 * Get subtask count for a parent task (useful for showing counts in UI)
 * @param {number} parentTaskId - The ID of the parent task
 * @returns {Promise<{total: number, completed: number}>} Counts of subtasks
 */
export async function getSubtaskCounts(parentTaskId) {
  const { data, error } = await supabase
    .from("subtasks")
    .select("completed")
    .eq("parent_task_id", parentTaskId);

  if (error) {
    console.error("Error getting subtask counts:", error);
    return { total: 0, completed: 0 };
  }

  const total = data?.length || 0;
  const completed = data?.filter((subtask) => subtask.completed).length || 0;

  return { total, completed };
}
