"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import styles from "./page.module.css";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendar,
  faHome,
  faGlobe,
  faListOl,
  faBrain,
  faDumbbell,
  faMusic,
  faSoccerBall,
  faTv,
  faLaptop,
  faLanguage,
  faCode,
  faCube,
  faLeaf,
  faEarthAmericas,
} from "@fortawesome/free-solid-svg-icons";

export default function Dashboard() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className={styles.dashboardContainer + " pageContainer"}>
          <div className="cardParent">
            <div className="card segmentCard">
              <Link href="/tasks">
                <FontAwesomeIcon icon={faCalendar} /> Tasks
              </Link>
            </div>
            <div className="card segmentCard">
              <a
                href="https://system-trainer.vercel.app/journeys/67f995f74918a8fa351e8f5b"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FontAwesomeIcon icon={faHome} /> Memory Palace
              </a>
            </div>
            <div className="card segmentCard">
              <Link href="/places">
                <FontAwesomeIcon icon={faGlobe} /> Places
              </Link>
            </div>
            <div className="card segmentCard">
              <Link href="/number-locations">
                <FontAwesomeIcon icon={faListOl} /> Number locations
              </Link>
            </div>
            <div className="card segmentCard">
              <Link href="/tv-film">
                <FontAwesomeIcon icon={faTv} /> TV/Film
              </Link>
            </div>
            <div className="card segmentCard">
              <Link href="/work">
                <FontAwesomeIcon icon={faLaptop} /> Work
              </Link>
            </div>
            <div className="card segmentCard">
              <a
                href="https://multilingual-flax.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FontAwesomeIcon icon={faLanguage} /> Languages
              </a>
            </div>
            <div className="card segmentCard">
              <Link href="/coding">
                <FontAwesomeIcon icon={faCode} /> Coding
              </Link>
            </div>
            <div className="card segmentCard">
              <Link href="/genealogy">
                <FontAwesomeIcon icon={faLeaf} /> Genealogy
              </Link>
            </div>
            <div className="card segmentCard">
              <Link href="/geoguessr">
                <FontAwesomeIcon icon={faEarthAmericas} /> GeoGuessr
              </Link>
            </div>
            <div className="card segmentCard">
              <Link href="/cubing">
                <FontAwesomeIcon icon={faCube} /> Cubing
              </Link>
            </div>
            <div className="card segmentCard">
              <Link href="/pi">Π Pi</Link>
            </div>
            <div className="card segmentCard">
              <Link href="/memory-training">
                <FontAwesomeIcon icon={faBrain} /> Memory training
              </Link>
            </div>
            <div className="card segmentCard">
              <Link href="/exercise">
                <FontAwesomeIcon icon={faDumbbell} /> Exercise
              </Link>
            </div>
            <div className="card segmentCard">
              <Link href="/music">
                <FontAwesomeIcon icon={faMusic} /> Music
              </Link>
            </div>
            <div className="card segmentCard">
              <Link href="/sport">
                <FontAwesomeIcon icon={faSoccerBall} /> Sport
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
