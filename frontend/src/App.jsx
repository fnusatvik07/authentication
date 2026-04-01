import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Home from './pages/Home'
import LearnPage from './pages/LearnPage'
import ProjectIndex from './pages/projects/ProjectIndex'
import ProjectDetail from './pages/projects/ProjectDetail'
import Cheatsheet from './pages/Cheatsheet'
import Playground from './pages/Playground'
import NotFound from './pages/NotFound'

function PageWrapper({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname.startsWith('/learn') ? '/learn' : location.pathname}>
        <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/learn/:slug" element={<LearnPage />} />
        <Route path="/projects" element={<PageWrapper><ProjectIndex /></PageWrapper>} />
        <Route path="/projects/:id" element={<PageWrapper><ProjectDetail /></PageWrapper>} />
        <Route path="/cheatsheet" element={<PageWrapper><Cheatsheet /></PageWrapper>} />
        <Route path="/playground" element={<PageWrapper><Playground /></PageWrapper>} />
        <Route path="*" element={<PageWrapper><NotFound /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  )
}
