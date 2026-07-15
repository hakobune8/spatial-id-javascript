export type LngLatWithAltitude = {
  /** Longitude, in degrees */
  lng: number
  /** Latitude, in degrees */
  lat: number
  /** Altitude from the geoid, in meters. The maximum is below 33,554,432;
   * the minimum depends on zoom and is exposed by getMinimumAltitude().
   */
  alt?: number
}

export type LngLat = {lng: number, lat: number};
