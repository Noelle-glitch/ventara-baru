export async function uploadDataset(
  formData: FormData
) {
  return fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
}