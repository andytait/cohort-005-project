// PROTOTYPE: fills a user's Knock feed with realistic Notifications.
// Uses the test workflow (KNOCK_TEST_WORKFLOW_KEY) for every type, so the type
// rides in `data.type`. In the real thing each type is its own workflow and
// the feed item's `source.key` names it.
//
//   npx tsx scripts/prototype-seed-notifications.ts <userId>          # a batch of 8
//   npx tsx scripts/prototype-seed-notifications.ts <userId> trickle  # one every 8s, for toasts
import Database from "better-sqlite3";
import { Knock } from "@knocklabs/node";

process.loadEnvFile(".env");

const userId = Number(process.argv[2]);
const trickle = process.argv[3] === "trickle";
if (!userId) throw new Error("usage: <userId> [trickle]");

const db = new Database("data.db", { readonly: true });
const user = db
  .prepare("select id, name, role from users where id = ?")
  .get(userId) as { id: number; name: string; role: string };

type Lesson = {
  courseId: number;
  courseTitle: string;
  slug: string;
  lessonId: number;
  lessonTitle: string;
};

const lessonSql = `
  select c.id courseId, c.title courseTitle, c.slug, l.id lessonId, l.title lessonTitle
  from lessons l join modules m on m.id = l.module_id join courses c on c.id = m.course_id`;

const lessons = (
  user.role === "instructor"
    ? db.prepare(`${lessonSql} where c.instructor_id = ? limit 40`).all(userId)
    : db
        .prepare(
          `${lessonSql} join enrollments e on e.course_id = c.id where e.user_id = ? limit 40`
        )
        .all(userId)
) as Lesson[];
if (lessons.length === 0) throw new Error(`no courses for ${user.name}`);

const others = db
  .prepare("select id, name, role from users where id != ? and role != 'admin'")
  .all(userId) as { id: number; name: string; role: string }[];

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
let commentId = 900000 + Math.floor(Math.random() * 90000);

function discussion(type: string) {
  const l = pick(lessons);
  const author = pick(others);
  commentId += 1;
  return {
    actor: { id: String(author.id), name: author.name },
    data: {
      type,
      courseId: l.courseId,
      courseTitle: l.courseTitle,
      lessonId: l.lessonId,
      lessonTitle: l.lessonTitle,
      discussionQuestionId: commentId - 1,
      commentId,
      authorName: author.name,
      authorRole: author.role === "instructor" ? "Instructor" : "Student",
      url: `/courses/${l.slug}/lessons/${l.lessonId}`,
    },
  };
}

function refund() {
  const l = pick(lessons);
  return {
    data: {
      type: "refund-request-decided",
      courseId: l.courseId,
      courseTitle: l.courseTitle,
      refundRequestId: Math.floor(Math.random() * 1000),
      refundOutcome: pick(["approved", "declined"]),
      url: `/courses/${l.slug}`,
    },
  };
}

const makers =
  user.role === "instructor"
    ? [
        () => discussion("discussion-question-on-my-course"),
        () => discussion("discussion-question-on-my-course"),
        () => discussion("discussion-reply-in-joined-thread"),
      ]
    : [
        () => discussion("discussion-reply-to-my-question"),
        () => discussion("discussion-reply-to-my-question"),
        refund,
      ];

const knock = new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY });
const workflow = process.env.KNOCK_TEST_WORKFLOW_KEY!;

async function send() {
  const n = pick(makers)();
  await knock.workflows.trigger(workflow, {
    recipients: [{ id: String(user.id), name: user.name }],
    ...n,
  });
  console.log(`→ ${user.name}: ${n.data.type} (${n.data.courseTitle})`);
}

if (trickle) {
  for (;;) {
    await send();
    await new Promise((r) => setTimeout(r, 8000));
  }
} else {
  for (let i = 0; i < 8; i++) await send();
}
