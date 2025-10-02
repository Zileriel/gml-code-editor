import React from 'react'
import Sidebar from './views/Sidebar'
import Main from './views/Main'
import StatusBar from './views/StatusBar'

export default function App() {
  return (
    <main>
      <Sidebar />
      <Main />
      <StatusBar />
    </main>
  )
}
