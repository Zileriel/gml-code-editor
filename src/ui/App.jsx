import React from 'react'
import Sidebar from './views/Sidebar'
import Main from './views/Main'
import StatusBar from './views/StatusBar'
import Topbar from './views/Topbar'

export default function App() {
  return (
    <main>
      <Topbar />
      <Sidebar />
      <Main />
      <StatusBar />
    </main>
  )
}
