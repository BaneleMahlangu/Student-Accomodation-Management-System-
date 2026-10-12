export interface RoomBedAvailabilitySummary {
  capacity: number;
  total_beds: number;
  available_beds: number;
  occupied_beds: number;
  reserved_beds: number;
  blocked_beds: number;
}

export function formatRoomBedAvailability(room: RoomBedAvailabilitySummary): string {
  const counts = [
    `${room.occupied_beds} occupied`,
    `${room.available_beds} available`,
  ];
  if (room.reserved_beds > 0) counts.push(`${room.reserved_beds} reserved`);
  if (room.blocked_beds > 0) counts.push(`${room.blocked_beds} blocked`);

  const notAdded = Math.max(0, room.capacity - room.total_beds);
  if (notAdded > 0) counts.push(`${notAdded} bed${notAdded === 1 ? "" : "s"} not added`);

  return `${counts.join(" · ")} · ${room.capacity}-bed capacity`;
}
