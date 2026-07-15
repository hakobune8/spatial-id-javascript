export type LngLatWithAltitude = {
  /** Longitude, in degrees */
  lng: number
  /** Latitude, in degrees */
  lat: number
  /** Altitude from the geoid, in meters. Coordinate conversion supports the
   * ZFXY root voxel range (-33,554,432, 33,554,432).
   */
  alt?: number
}

export type LngLat = {lng: number, lat: number};
