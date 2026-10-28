export function mediaUrl(media: { id: string; public_path: string | null }) {
  return media.public_path || `/api/media/${media.id}/file`;
}
