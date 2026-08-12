import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, Clock, Sparkles } from 'lucide-react'
import { listCourses, flattenLessons } from '../lib/data'
import TopNav from '../components/TopNav'

function BackgroundCanvas() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      <img
        src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=2070&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        alt=""
        className="h-full w-full object-cover opacity-[0.510] dark:opacity-[0.64]"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/90 to-white dark:from-neutral-950/75 dark:via-neutral-950/90 dark:to-neutral-950" />
    </div>
  )
}

function HeroBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] w-screen left-1/2 -translate-x-1/2 overflow-hidden">
      {/* Full-bleed laptop photo */}
      <img
        src="https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?q=80&w=1170&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
        alt=""
        className="h-full w-full object-cover opacity-[0.310] dark:opacity-[0.14]"
      />
      {/* Wash it toward the page background so it reads as texture, not a photo */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-white/90 to-white dark:from-neutral-950/75 dark:via-neutral-950/92 dark:to-neutral-950" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(circle at 30% 20%, rgba(245,158,11,0.08) 0%, transparent 60%)' }}
      />
    </div>
  )
}

export default function Home() {
  const [courses, setCourses] = useState(null)

  useEffect(() => {
    listCourses({ onlyPublished: true }).then(setCourses)
  }, [])

  return (
    <div className="relative min-h-screen">
      <BackgroundCanvas />

      <div className="relative z-10">
        <TopNav  />

        <section className="relative mx-auto max-w-5xl px-6 pb-12 pt-16">
          {/* <HeroBackground /> */}

       
          <h1 className="mt-5 max-w-3xl font-sans text-2xl font-semibold leading-tight text-neutral-950 dark:text-white lg:text-5xl">
            Courses that build practical, career-ready skills
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
            Pick a course, see exactly what's inside before you buy, and get instant
            access the moment payment clears.
          </p>

        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24">
          {courses === null && (
            <div className="grid gap-6 sm:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <CourseCardSkeleton key={index} />
              ))}
            </div>
          )}
          {courses?.length === 0 && (
            <div className="rounded-2xl border border-dashed border-amber-300 bg-white/70 p-10 text-center text-zinc-500 dark:border-amber-400/20 dark:bg-neutral-900/70 dark:text-zinc-400">
              No courses published yet. Check back soon.
            </div>
          )}
          <div className="grid gap-6 sm:grid-cols-2">
            {courses?.map(course => <CourseCard key={course.id} course={course} />)}
          </div>
        </section>
      </div>
    </div>
  )
}

function CourseCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-white/85 shadow-sm dark:border-amber-400/10 dark:bg-neutral-900/85">
      <div className="skeleton-shimmer aspect-[16/9] bg-zinc-100/70 dark:bg-neutral-800" />

      <div className="p-5">
        <div className="skeleton-shimmer h-6 w-4/5 rounded-md bg-neutral-200 dark:bg-neutral-800" />
        <div className="mt-2 space-y-2">
          <div className="skeleton-shimmer h-3.5 w-full rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="skeleton-shimmer h-3.5 w-2/3 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="skeleton-shimmer h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="skeleton-shimmer h-5 w-16 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-amber-100 pt-4 dark:border-amber-400/10">
          <div className="skeleton-shimmer h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-800" />
          <div className="skeleton-shimmer h-4 w-4 rounded bg-neutral-200 dark:bg-neutral-800" />
        </div>
      </div>
    </div>
  )
}

function CourseCard({ course }) {
  const lessonCount = flattenLessons(course).length

  return (
    <Link
      to={`/courses/${course.id}`}
      className="group block overflow-hidden rounded-2xl border border-amber-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-[0_18px_44px_-24px_rgba(146,64,14,0.55)] dark:border-amber-400/10 dark:bg-neutral-900"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-amber-50 dark:bg-neutral-800">
        {course.coverImage ? (
          <img
            src={course.coverImage}
            alt=""
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-amber-500">
            <BookOpen className="h-10 w-10" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/35 to-transparent opacity-0 transition group-hover:opacity-100" />
      </div>

      <div className="p-5">
        <h3 className="text-xl font-semibold leading-snug tracking-tight text-neutral-950 dark:text-white">{course.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{course.subtitle}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-zinc-500 dark:text-zinc-400">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            {lessonCount} lessons
          </span>
          <span className="font-semibold text-neutral-950 dark:text-white">
            {course.price ? `₦${Number(course.price).toLocaleString()}` : 'Free'}
          </span>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-amber-100 pt-4 dark:border-amber-400/10">
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">View course</span>
          <ArrowRight className="h-4 w-4 text-amber-600 transition group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  )
}
