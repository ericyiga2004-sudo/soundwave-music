import React from 'react'
import Hero from '../components/Hero/Hero'
import Trending from '../components/Trending/Trending'
import NewRelease from '../components/NewRelease/NewRelease'
import PopularArtist from '../components/PopularArtist/PopularArtist'
import Albums from '../components/Albums/Albums'
import FilterSongs from '../components/FilterSongs/FilterSongs'
import Yearly from '../components/Nineteen/Yearly'
import MadeForYou from '../components/MadeForYou/MadeForYou'
import ContinueListening from '../components/ContinueListening/ContinueListening'
import YouLiked from '../components/YouLiked/YouLiked'

const Home = () => {
  return (
    <div>
        <Hero/>
        {/* <Trending/> */}
        <MadeForYou/>
        <ContinueListening/>
        <YouLiked/>
        <NewRelease/>
        <PopularArtist/>
        <Albums/>
        <FilterSongs/>
        <Yearly/>
    </div>
  )
}

export default Home  