import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendar,
  faHome,
  faGlobe,
  faListOl,
} from "@fortawesome/free-solid-svg-icons";

export default function Dashboard() {
  return (
    <div className="content">
      <h2>Dashboard</h2>
      <div className="one">
        <div className="cardParent">
          <div className="card segmentCard">
            <Link href="/tasks">
              <FontAwesomeIcon icon={faCalendar} /> Tasks
            </Link>
          </div>
          <div className="card segmentCard">
            <Link href="https://system-trainer.vercel.app/journeys/67f995f74918a8fa351e8f5b">
              <FontAwesomeIcon icon={faHome} /> Memory Palace
            </Link>
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
        </div>
      </div>
    </div>
  );
}
