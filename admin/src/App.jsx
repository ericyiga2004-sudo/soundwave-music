import React from 'react'
import AddArtist from './components/AddArtist'
import AddAlbum from './components/AddAlbum'
import AddSong from './components/AddSong'


export const backendUrl = import.meta.env.VITE_BACKEND_URL

const App = () => {
  return (
    <div>
      <AddArtist/>
      <AddAlbum/>
      <AddSong/>
    </div>
  )
}

export default App