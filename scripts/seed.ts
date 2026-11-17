import * as schema from "../app/db/schema";
import { LessonProgressStatus, TeamMemberRole } from "../app/db/schema";
import { eq } from "drizzle-orm";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { defaultNotifications } from "../app/lib/notifications.server";
import { syncAllUsers } from "../app/lib/notification-preferences.server";
import { countRows, db, resetDatabase } from "./seed-data/db";
import { daysAgo, hoursAgo, makeRandom } from "./seed-data/helpers";
import { seedUsers } from "./seed-data/users";
import { seedCategories } from "./seed-data/course-content";
import { seedCourse1 } from "./seed-data/course-1";
import { seedCourse2 } from "./seed-data/course-2";
import {
  seedCourse3,
  seedCourse4,
  seedCourse5,
} from "./seed-data/extra-courses";
import { seedQuizzes } from "./seed-data/quizzes";
import { seedEnrollments, seedRatings } from "./seed-data/enrollments";
import { seedComments } from "./seed-data/comments";
import { seedLessonProgress } from "./seed-data/progress";
import { seedFirstTeam, seedIndividualPurchases } from "./seed-data/purchases";
import {
  fullPriceCountries,
  loadLessonDurationSeconds,
  pppCountries,
  sellableCoursesFor,
  type SellableCourse,
} from "./seed-data/generated-history";
import { seedLiamRefund, seedMartaRefund } from "./seed-data/refunds";
import { printSummary } from "./seed-data/summary";
import type { Seeded } from "./seed-data/types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Runs under tsx, not Vite, so load .env for the Knock keys ourselves.
const envFile = path.resolve(__dirname, "../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

// ─── Seed Data ───

async function seed() {
  console.log("Seeding database...");

  resetDatabase();

  const {
    admin,
    instructor1,
    instructor2,
    students,
    bossy,
    cohort,
    studentByEmail,
  } = seedUsers();

  const catBySlug = seedCategories();

  const { course1, course1LessonIds } = seedCourse1(instructor1, catBySlug);
  const { course2, course2LessonIds } = seedCourse2(instructor2, catBySlug);
  const { course3, course3LessonIds } = seedCourse3(instructor1, catBySlug);
  seedCourse4(instructor2, catBySlug);
  seedCourse5(instructor2, catBySlug);

  const {
    quiz1,
    quiz1OptionIds,
    quiz2,
    quiz2OptionIds,
    quiz3,
    quiz3OptionIds,
  } = seedQuizzes(course1LessonIds, course2LessonIds);

  const seeded: Seeded = {
    admin,
    instructor1,
    instructor2,
    students,
    bossy,
    studentByEmail,
    course1,
    course2,
    course3,
    course1LessonIds,
    course2LessonIds,
    course3LessonIds,
  };

  seedEnrollments(seeded);
  seedRatings(seeded);
  seedComments(seeded);
  seedLessonProgress(seeded);

  // ─── Quiz Attempts ───

  // Helper to record a quiz attempt with answers
  function recordQuizAttempt(
    userId: number,
    quizId: number,
    optionIds: { questionId: number; optionId: number; correct: boolean }[],
    selectedCorrectIndices: number[], // which questions (0-based) the student got right
    attemptDaysAgo: number
  ) {
    const totalQuestions = new Set(optionIds.map((o) => o.questionId)).size;
    const correctCount = selectedCorrectIndices.length;
    const score = correctCount / totalQuestions;

    // Determine passing based on quiz passingScore (we'll just use 0.7 as default)
    const passed = score >= 0.7;

    const [attempt] = db
      .insert(schema.quizAttempts)
      .values({
        userId,
        quizId,
        score,
        passed,
        attemptedAt: daysAgo(attemptDaysAgo),
      })
      .returning()
      .all();

    // Build answer selections
    const questionIds = [...new Set(optionIds.map((o) => o.questionId))];
    for (let qi = 0; qi < questionIds.length; qi++) {
      const qId = questionIds[qi];
      const qOptions = optionIds.filter((o) => o.questionId === qId);
      // Pick a correct answer for the questions answered correctly, a wrong
      // one for the rest
      const wantCorrect = selectedCorrectIndices.includes(qi);
      const selectedOption = qOptions.find((o) => o.correct === wantCorrect);
      if (!selectedOption) {
        throw new Error(
          `Question ${qId} has no ${wantCorrect ? "correct" : "wrong"} option`
        );
      }

      db.insert(schema.quizAnswers)
        .values({
          attemptId: attempt.id,
          questionId: qId,
          selectedOptionId: selectedOption.optionId,
        })
        .run();
    }
  }

  // Emma — passed quiz 1 (3/3 correct)
  recordQuizAttempt(students[0].id, quiz1.id, quiz1OptionIds, [0, 1, 2], 35);

  // Emma — passed quiz 2 (2/2 correct)
  recordQuizAttempt(students[0].id, quiz2.id, quiz2OptionIds, [0, 1], 30);

  // Emma — passed quiz 3 (2/3 correct, just barely at 67% with 70% passing = fail, then retake)
  recordQuizAttempt(students[0].id, quiz3.id, quiz3OptionIds, [0, 2], 28);
  // Retake — all correct
  recordQuizAttempt(students[0].id, quiz3.id, quiz3OptionIds, [0, 1, 2], 27);

  // James — passed quiz 1 (3/3 correct)
  recordQuizAttempt(students[1].id, quiz1.id, quiz1OptionIds, [0, 1, 2], 40);

  // James — passed quiz 2 (2/2 correct)
  recordQuizAttempt(students[1].id, quiz2.id, quiz2OptionIds, [0, 1], 35);

  // Olivia — failed quiz 1 first attempt (1/3 correct), then passed on retry (3/3)
  recordQuizAttempt(students[2].id, quiz1.id, quiz1OptionIds, [0], 25);
  recordQuizAttempt(students[2].id, quiz1.id, quiz1OptionIds, [0, 1, 2], 24);

  // Olivia — passed quiz 3 (3/3 correct)
  recordQuizAttempt(students[2].id, quiz3.id, quiz3OptionIds, [0, 1, 2], 20);

  // Sophia — failed quiz 1 (1/3 correct, hasn't retaken yet)
  recordQuizAttempt(students[4].id, quiz1.id, quiz1OptionIds, [1], 10);

  console.log(
    `Created ${countRows(schema.quizAttempts)} quiz attempts and ${countRows(schema.quizAnswers)} answers.`
  );

  // ─── Video Watch Events ───
  //
  // The only event types the player emits are `play`, `pause`, `ended` and
  // `progress` — see app/components/youtube-player.tsx. `progress` is the
  // heartbeat it posts every 10 seconds while the video is playing, so in real
  // data it outnumbers every other type by an order of magnitude. Seed nothing
  // the player cannot produce, and never a watch session without heartbeats.

  const HEARTBEAT_INTERVAL_SECONDS = 10;

  type WatchEventRow = typeof schema.videoWatchEvents.$inferInsert;

  const watchEventRows: WatchEventRow[] = [];

  function addWatchEvent(
    userId: number,
    lessonId: number,
    eventType: string,
    positionSeconds: number,
    eventHoursAgo: number
  ) {
    watchEventRows.push({
      userId,
      lessonId,
      eventType,
      positionSeconds,
      createdAt: hoursAgo(eventHoursAgo),
    });
  }

  // One watch session: `play`, a `progress` heartbeat every 10 seconds of
  // playback, then `ended` if they reached the end or `pause` if they stopped
  // short. Clock time advances with playback position, as it does in real life.
  function addWatchSession(
    userId: number,
    lessonId: number,
    fromSeconds: number,
    toSeconds: number,
    videoDurationSeconds: number,
    startHoursAgo: number
  ) {
    // Clock time runs backwards from startHoursAgo as playback advances.
    const hoursAgoAt = (position: number) =>
      startHoursAgo - (position - fromSeconds) / 3600;

    addWatchEvent(userId, lessonId, "play", fromSeconds, startHoursAgo);

    for (
      let pos = fromSeconds + HEARTBEAT_INTERVAL_SECONDS;
      pos < toSeconds;
      pos += HEARTBEAT_INTERVAL_SECONDS
    ) {
      addWatchEvent(userId, lessonId, "progress", pos, hoursAgoAt(pos));
    }

    const reachedEnd = toSeconds >= videoDurationSeconds;
    addWatchEvent(
      userId,
      lessonId,
      reachedEnd ? "ended" : "pause",
      toSeconds,
      hoursAgoAt(toSeconds)
    );
  }

  // Emma watched course 1 lesson 1 (8 min video) in two sittings.
  addWatchSession(students[0].id, course1LessonIds[0], 0, 180, 480, 50 * 24);
  addWatchSession(students[0].id, course1LessonIds[0], 180, 480, 480, 49 * 24);

  // James watched it straight through.
  addWatchSession(students[1].id, course1LessonIds[0], 0, 480, 480, 45 * 24);

  // Liam started course 2 lesson 1 and gave up six minutes in.
  addWatchSession(students[3].id, course2LessonIds[0], 0, 300, 600, 22 * 24);
  addWatchSession(students[3].id, course2LessonIds[0], 300, 360, 600, 21 * 24);

  seedIndividualPurchases(seeded);
  seedFirstTeam(seeded);

  // ─── Generated history ───
  //
  // Everything above is hand-written narrative data: a handful of students whose
  // comments, quiz attempts and ratings are written one by one. Everything below
  // is the bulk history the analytics work is evaluated against — roughly twelve
  // months of purchases, enrolments, progress and watch events for the cohort.
  //
  // Generated from a fixed PRNG seed, so every run produces the same database and
  // a number read off the dashboard can be checked against a number computed
  // here.

  const random = makeRandom(20260731);
  const lessonDurationSeconds = loadLessonDurationSeconds();

  const sellableCourses = sellableCoursesFor(seeded);

  const sold = new Set<string>();
  let generatedPurchases = 0;
  let generatedEnrollments = 0;
  let generatedProgressRows = 0;

  // A student buys, enrols, and works through the course as far as they get.
  // Returns false if there was nothing they could have bought on that day — a
  // course cannot be sold before it was created, and nobody buys twice.
  function buyCourse(
    buyer: (typeof cohort)[number],
    purchasedDaysAgo: number
  ): boolean {
    const purchasedAt = Date.parse(daysAgo(purchasedDaysAgo));

    const available = sellableCourses.filter(
      (c) =>
        Date.parse(c.course.createdAt) <= purchasedAt &&
        !sold.has(`${buyer.id}:${c.course.id}`)
    );

    if (available.length === 0) return false;

    const target = available[Math.floor(random() * available.length)];
    sold.add(`${buyer.id}:${target.course.id}`);

    // Two in five buy at a parity-adjusted price.
    const ppp = random() < 0.4;
    const country = ppp
      ? pppCountries[Math.floor(random() * pppCountries.length)]
      : fullPriceCountries[Math.floor(random() * fullPriceCountries.length)];
    const amountPaid = ppp
      ? Math.round((target.course.price * 0.5) / 100) * 100
      : target.course.price;

    db.insert(schema.purchases)
      .values({
        userId: buyer.id,
        courseId: target.course.id,
        amountPaid,
        country,
        createdAt: daysAgo(purchasedDaysAgo),
      })
      .run();
    generatedPurchases++;

    db.insert(schema.enrollments)
      .values({
        userId: buyer.id,
        courseId: target.course.id,
        enrolledAt: daysAgo(purchasedDaysAgo),
      })
      .run();
    generatedEnrollments++;

    generatedProgressRows += generateProgress(
      buyer.id,
      target,
      purchasedDaysAgo
    );

    return true;
  }

  const signupDaysAgo = (student: (typeof cohort)[number]) =>
    Math.round((Date.now() - Date.parse(student.createdAt)) / 86_400_000);

  // Purchases hang off sign-up dates, which already span the year: everyone buys
  // something within days of joining, and about two in five come back for a
  // second course a few months later.
  for (const buyer of cohort) {
    const joined = signupDaysAgo(buyer);

    buyCourse(buyer, Math.max(0, joined - Math.floor(random() * 4)));

    if (random() < 0.42) {
      buyCourse(buyer, Math.max(1, joined - 90 - Math.floor(random() * 20)));
    }
  }

  // Launch week: a burst of sales from long-standing students inside the last
  // seven days, so the short date ranges are never empty and never identical to
  // the long ones.
  const launchWeekDays = [7, 6, 5, 3, 2, 1];
  const longStanding = cohort.filter((s) => signupDaysAgo(s) > 60);

  for (let i = 0; i < launchWeekDays.length; i++) {
    buyCourse(longStanding[i % longStanding.length], launchWeekDays[i]);
  }

  // Walks a student through a course as far as they got, leaving the lesson
  // after their last completed one in progress. Returns the number of rows
  // written.
  function generateProgress(
    userId: number,
    target: SellableCourse,
    startedDaysAgo: number
  ): number {
    const { lessonIds, cliffs } = target;
    const lastIndex = lessonIds.length - 1;

    const roll = random();
    let stopIndex: number;

    if (roll < 0.12) {
      // Bought it and never opened it.
      return 0;
    } else if (roll < 0.5) {
      stopIndex = cliffs[0];
    } else if (roll < 0.72) {
      stopIndex = cliffs[1];
    } else if (roll < 0.85) {
      stopIndex = lastIndex;
    } else {
      stopIndex = Math.floor(random() * lessonIds.length);
    }

    // Progress is made over the days following the purchase, and never in the
    // future.
    const daySpan = Math.min(startedDaysAgo, 30);
    let rows = 0;

    for (let li = 0; li <= stopIndex; li++) {
      const completedDaysAgo = Math.max(
        0,
        Math.round(startedDaysAgo - (daySpan * li) / lessonIds.length)
      );
      db.insert(schema.lessonProgress)
        .values({
          userId,
          lessonId: lessonIds[li],
          status: LessonProgressStatus.Completed,
          completedAt: daysAgo(completedDaysAgo),
        })
        .run();
      rows++;

      // The lesson they stopped on is left half-watched: a session that never
      // reached the end, heartbeats and all.
      if (li === stopIndex) {
        const duration = lessonDurationSeconds.get(lessonIds[li]) ?? 600;
        addWatchSession(
          userId,
          lessonIds[li],
          0,
          duration,
          duration,
          completedDaysAgo * 24 + 1
        );
      }
    }

    if (stopIndex < lastIndex) {
      const nextLessonId = lessonIds[stopIndex + 1];
      db.insert(schema.lessonProgress)
        .values({
          userId,
          lessonId: nextLessonId,
          status: LessonProgressStatus.InProgress,
        })
        .run();
      rows++;

      const duration = lessonDurationSeconds.get(nextLessonId) ?? 600;
      const abandonedAt = Math.round(duration * (0.1 + random() * 0.5));
      addWatchSession(
        userId,
        nextLessonId,
        0,
        abandonedAt,
        duration,
        Math.max(1, Math.round(startedDaysAgo * 24 * 0.4))
      );
    }

    return rows;
  }

  console.log(
    `Created ${generatedPurchases} generated purchases, ${generatedEnrollments} enrolments and ${generatedProgressRows} lesson progress rows.`
  );

  // ─── Further team purchases ───
  // Two more seat purchases so team revenue is not a single row, in mixed
  // redemption states: one team most of the way through its seats, one that has
  // bought and redeemed nothing yet.

  function createTeamPurchase(
    adminEmail: string,
    course: typeof course1,
    seats: number,
    codePrefix: string,
    purchasedDaysAgo: number,
    redeemerEmails: string[]
  ) {
    const teamAdmin = studentByEmail(adminEmail);

    const [team] = db
      .insert(schema.teams)
      .values({ createdAt: daysAgo(purchasedDaysAgo) })
      .returning()
      .all();

    db.insert(schema.teamMembers)
      .values({
        teamId: team.id,
        userId: teamAdmin.id,
        role: TeamMemberRole.Admin,
        createdAt: daysAgo(purchasedDaysAgo),
      })
      .run();

    const [purchase] = db
      .insert(schema.purchases)
      .values({
        userId: teamAdmin.id,
        courseId: course.id,
        amountPaid: course.price * seats,
        country: "US",
        createdAt: daysAgo(purchasedDaysAgo),
      })
      .returning()
      .all();

    const teamCoupons = db
      .insert(schema.coupons)
      .values(
        Array.from({ length: seats }, (_, i) => ({
          teamId: team.id,
          courseId: course.id,
          code: `${codePrefix}-${String(i + 1).padStart(2, "0")}`,
          purchaseId: purchase.id,
          createdAt: daysAgo(purchasedDaysAgo),
        }))
      )
      .returning()
      .all();

    // Redeemers named by email, for the reason given at the first team above.
    redeemerEmails.forEach((email, i) => {
      const redeemer = studentByEmail(email);
      const redeemedDaysAgo = Math.max(0, purchasedDaysAgo - (i + 1) * 2);

      db.update(schema.coupons)
        .set({
          redeemedByUserId: redeemer.id,
          redeemedAt: daysAgo(redeemedDaysAgo),
        })
        .where(eq(schema.coupons.id, teamCoupons[i].id))
        .run();

      db.insert(schema.teamMembers)
        .values({
          teamId: team.id,
          userId: redeemer.id,
          role: TeamMemberRole.Member,
          createdAt: daysAgo(redeemedDaysAgo),
        })
        .run();

      db.insert(schema.enrollments)
        .values({
          userId: redeemer.id,
          courseId: course.id,
          enrolledAt: daysAgo(redeemedDaysAgo),
        })
        .run();
    });

    return { team, purchase, coupons: teamCoupons };
  }

  // Eight seats on TypeScript, six redeemed.
  createTeamPurchase(
    "ava.nakamura@student.dev",
    course1,
    8,
    "TEAM-TS-NAKAMURA",
    120,
    [
      "noah.blackwood@student.dev",
      "isla.fernandes@student.dev",
      "ethan.okafor@student.dev",
      "mia.lindqvist@student.dev",
      "lucas.moreau@student.dev",
      "zara.haddad@student.dev",
    ]
  );

  // Four seats on Design Systems, bought during launch week, none redeemed yet.
  const novakLicence = createTeamPurchase(
    "marta.novak@student.dev",
    course3,
    4,
    "TEAM-DS-NOVAK",
    4,
    []
  );

  seedLiamRefund(seeded);

  seedMartaRefund(novakLicence);

  // ─── Flush watch events ───
  // Batched: the heartbeat makes these by far the largest table, and one
  // statement per row would dominate the seed's runtime.

  const WATCH_EVENT_CHUNK = 400;
  for (let i = 0; i < watchEventRows.length; i += WATCH_EVENT_CHUNK) {
    db.insert(schema.videoWatchEvents)
      .values(watchEventRows.slice(i, i + WATCH_EVENT_CHUNK))
      .run();
  }

  console.log(`Created ${watchEventRows.length} video watch events.`);
  printSummary();

  // ─── Sync users to Knock ───
  // Name, email, avatar, and default preferences for anyone without a set.
  if (process.env.KNOCK_SECRET_API_KEY) {
    const synced = await syncAllUsers(db, await defaultNotifications());
    console.log(`  Synced ${synced} users to Knock.`);
  } else {
    console.log("  Skipped Knock user sync: KNOCK_SECRET_API_KEY is not set.");
  }
}

seed().catch(console.error);
