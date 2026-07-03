declare module 'tz-lookup' {
  /** IANA timezone name for a coordinate, e.g. "Europe/Bucharest" */
  export default function tzlookup(lat: number, lng: number): string
}
