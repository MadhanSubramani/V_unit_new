export async function getGstinDetails(
  gstin: string
) {
  const response = await fetch(
    `https://sheet.gstincheck.co.in/check/8d30fc24dac86f67a929ea4c16e7ad34/${gstin}`
  );

  if (!response.ok)
    throw new Error("Unable to fetch GST");

  return response.json();
}