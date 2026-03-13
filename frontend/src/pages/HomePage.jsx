import { Link } from 'react-router'
import { Button } from '../components/ui/button'

function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center gap-6 px-6 py-16">
        <p className="text-lg uppercase tracking-[0.25em] ">
          Welcome to TeamDer
        </p>
        <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">
          Team creation application for instructors to create teams for students.
          <br/>
          Easy to use, Keep teams fair while keeping students happy.
          
        </p>
        <div className="flex gap-3">
          <Button asChild>
            <Link to="/test">Component Test Page</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}

export default HomePage
