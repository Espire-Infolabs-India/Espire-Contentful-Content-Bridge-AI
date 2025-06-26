import React from "react";
import Link from "next/link";

const Sidebar: React.FC = () => (
  <div>
    <Link href="/" legacyBehavior>
      <a className="d-flex align-items-center mb-3 mb-md-0 me-md-auto link-dark text-decoration-none">
        <svg className="bi me-2" width="40" height="32">
          <use xlinkHref="#bootstrap" />
        </svg>
      </a>
    </Link>

    <hr />
    <ul className="nav nav-pills flex-column mb-auto">
      <li className="nav-item">
        <a href="#" className="nav-link active" aria-current="page">
          <svg className="bi me-2" width="16" height="16">
            <use xlinkHref="#home" />
          </svg>
          Home
        </a>
      </li>
      <li>
        <a href="#" className="nav-link link-dark">
          <svg className="bi me-2" width="16" height="16">
            <use xlinkHref="#speedometer2" />
          </svg>
          Dashboard
        </a>
      </li>
      <li>
        <a href="#" className="nav-link link-dark">
          <svg className="bi me-2" width="16" height="16">
            <use xlinkHref="#table" />
          </svg>
          Orders
        </a>
      </li>
      <li>
        <a href="#" className="nav-link link-dark">
          <svg className="bi me-2" width="16" height="16">
            <use xlinkHref="#grid" />
          </svg>
          Products
        </a>
      </li>
    </ul>
  </div>
);

export default Sidebar;
