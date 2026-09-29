import { courseLevelLabels, type CourseLevel } from "@/lib/model";
import { Badge } from "./ui/badge";

export function CourseLevelBadge({ level }: { level: CourseLevel }) {
  return <Badge variant={level}>{courseLevelLabels[level]}</Badge>;
}
