import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { Home, BookOpen, FolderCode } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-md mx-auto px-6 pt-32 text-center">
        <div className="text-6xl font-bold text-[var(--color-text-dim)] mb-4">404</div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Page not found</h1>
        <p className="text-[var(--color-text-muted)] mb-8">The page you're looking for doesn't exist or has been moved.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/" className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-xl text-sm font-semibold flex items-center gap-2 hover:bg-[var(--color-primary-light)] transition-colors">
            <Home size={16} /> Home
          </Link>
          <Link to="/learn" className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text)] rounded-xl text-sm font-semibold flex items-center gap-2 hover:border-[var(--color-primary)]/30 transition-colors">
            <BookOpen size={16} /> Learn
          </Link>
          <Link to="/projects" className="px-4 py-2 border border-[var(--color-border)] text-[var(--color-text)] rounded-xl text-sm font-semibold flex items-center gap-2 hover:border-[var(--color-primary)]/30 transition-colors">
            <FolderCode size={16} /> Projects
          </Link>
        </div>
      </div>
    </div>
  )
}
