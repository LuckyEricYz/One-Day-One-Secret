export type OptionalLocation = {
  latitude: number;
  longitude: number;
} | null;

export async function getGrantedLocation(): Promise<OptionalLocation> {
  if (
    typeof window === "undefined" ||
    !("permissions" in navigator) ||
    !("geolocation" in navigator)
  ) {
    return null;
  }

  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    if (status.state !== "granted") {
      return null;
    }

    return await new Promise<OptionalLocation>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }),
        () => resolve(null),
        { timeout: 2500, maximumAge: 60_000 }
      );
    });
  } catch {
    return null;
  }
}

