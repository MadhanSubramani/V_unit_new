export async function getGstinDetails(
  gstin: string
) {
  const response = await fetch(
    `http://sheet.gstincheck.co.in/check/067551d7ea5e9c03d00ef3f94e330b74/${gstin}`
  );

  if (!response.ok)
    throw new Error("Unable to fetch GST");

  return response.json();
}