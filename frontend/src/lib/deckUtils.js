const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatDeckDate(value) {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return dateFormatter.format(date);
}

export function formatDeckCourseTopic(deck) {
  return `${deck.course_name} / ${deck.topic_name}`;
}

export function formatDeckProgress(value) {
  return `${Math.round(value || 0)}%`;
}
