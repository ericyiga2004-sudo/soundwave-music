import React from 'react'
import Hero from '../components/Hero/Hero'
import Trending from '../components/Trending/Trending'
import NewRelease from '../components/NewRelease/NewRelease'
import PopularArtist from '../components/PopularArtist/PopularArtist'
import Albums from '../components/Albums/Albums'
import FilterSongs from '../components/FilterSongs/FilterSongs'
import Yearly from '../components/Nineteen/Yearly'

const Home = () => {
  return (
    <div>
        <Hero/>
        {/* <Trending/> */}
        <NewRelease/>
        <PopularArtist/>
        <Albums/>
        <FilterSongs/>
        <Yearly/>
    </div>
  )
}

export default Home