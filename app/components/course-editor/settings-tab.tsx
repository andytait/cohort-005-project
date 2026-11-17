import { Link } from "react-router";
import { Eye, Globe } from "lucide-react";
import { CourseStatus } from "~/db/schema";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { EditorCourse, Fetcher } from "./types";

type CourseFetcherProps = {
  course: EditorCourse;
  fetcher: Fetcher;
};

function StatusCard({
  course,
  handleStatusChange,
}: {
  course: EditorCourse;
  handleStatusChange: (newStatus: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Course Status</h2>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <Select value={course.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={CourseStatus.Draft}>Draft</SelectItem>
              <SelectItem value={CourseStatus.Published}>Published</SelectItem>
              <SelectItem value={CourseStatus.Archived}>Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function PriceInput({ course, fetcher: priceFetcher }: CourseFetcherProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Price:</span>
      <div className="flex items-center gap-1">
        <span className="text-sm text-muted-foreground">$</span>
        <Input
          type="number"
          min="0"
          max="9999.99"
          step="0.01"
          defaultValue={(course.price / 100).toFixed(2)}
          className="w-28"
          onBlur={(event) => {
            const value = parseFloat(event.target.value);
            if (
              !isNaN(value) &&
              value >= 0 &&
              Math.round(value * 100) !== course.price
            ) {
              priceFetcher.submit(
                {
                  intent: "update-price",
                  price: event.target.value,
                },
                { method: "post" }
              );
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              (event.target as HTMLInputElement).blur();
            }
          }}
        />
      </div>
    </div>
  );
}

function PppToggle({ course, fetcher: pppFetcher }: CourseFetcherProps) {
  return (
    <div
      className="flex items-center gap-2"
      title="Purchasing Power Parity: applies location-based discounts for students in lower-income countries"
    >
      <Globe className="size-4 text-muted-foreground" />
      <span className="text-sm font-medium">PPP:</span>
      <button
        type="button"
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          course.pppEnabled ? "bg-primary" : "bg-muted"
        }`}
        onClick={() => {
          pppFetcher.submit(
            {
              intent: "update-ppp-enabled",
              pppEnabled: String(!course.pppEnabled),
            },
            { method: "post" }
          );
        }}
      >
        <span
          className={`inline-block size-4 transform rounded-full bg-white transition-transform ${
            course.pppEnabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className="text-xs text-muted-foreground">
        {course.pppEnabled ? "On" : "Off"}
      </span>
    </div>
  );
}

function LinksCard({ course }: { course: EditorCourse }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold">Links</h2>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          <Link to={`/courses/${course.slug}`}>
            <Button variant="outline" size="sm">
              <Eye className="mr-1.5 size-4" />
              View Public Page
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsTab({
  course,
  handleStatusChange,
  priceFetcher,
  pppFetcher,
}: {
  course: EditorCourse;
  handleStatusChange: (newStatus: string) => void;
  priceFetcher: Fetcher;
  pppFetcher: Fetcher;
}) {
  return (
    <div className="space-y-6">
      <StatusCard course={course} handleStatusChange={handleStatusChange} />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Pricing</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <PriceInput course={course} fetcher={priceFetcher} />

            <PppToggle course={course} fetcher={pppFetcher} />
          </div>
        </CardContent>
      </Card>

      <LinksCard course={course} />
    </div>
  );
}
