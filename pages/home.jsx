import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import Navigation from "../components/Navigation";

export default function Home() {
  const router = useRouter();
  const videoRef = useRef(null)

  const wanRef = useRef(null)

  useEffect(() => {
    wanRef.current = new Audio("/sound/wan.mp3")
    wanRef.current.load()
  }, [])

  function playWan() {
    if (wanRef.current) {
      wanRef.current.currentTime = 0
      wanRef.current.play()
    }
    videoRef.current.currentTime = 0
    videoRef.current.play()
  }

  return (
    <div className="homeContainer">
      <div className="homeContent">

        <video
          ref={videoRef}
          src="/animations/wan.mp4"
          muted
          playsInline
          className="homePochi"
          onClick={playWan}
          style={{ cursor: "pointer" }}
          data-no-sound  
        />
        
        {/*
        <img src="/images/illustrations/pochi.png" className="homePochi" />   
        */}

        <h1 className="homeTitle"></h1>

        <div className="homeButtons">

          {/*
          <button
            className="homeBtn"
            onClick={() => router.push("/unitList")}
          >
            <img src="/images/illustrations/pochi_grammar.png" alt="英文法学習" />
            
          </button>

          <button
            className="homeBtn disabled"
            onClick={() => {}}
          >
            <img src="/images/illustrations/pochi_vocabulary.png" alt="英単語学習" />
            
          </button>
          */}


          <img
            src="/images/illustrations/pochi_story.png"
            alt="長文学習"
            className="homeBtnImg"
            onClick={() => router.push("/categoryList")}
          />

          <img
            src="/images/illustrations/pochi_vocabulary.png"
            alt="英単語学習"
            className="homeBtnImg"
            onClick={() => router.push("/stageList")}
          />

        </div>

        <button
          className="newsLink"
          onClick={() => router.push("/news")}
        >
          お知らせ
        </button>

      </div>
      <Navigation />
    </div>
  );
}