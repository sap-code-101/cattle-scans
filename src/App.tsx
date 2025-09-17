import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Scan from "./pages/Scan";
import Login from "./pages/Login";

function App() {

  return (
    <>
      <div className="bg-gradient-to-b from-green-100 to-white pb-30">
        <nav className="flex justify-between mx-10 pt-10 items-baseline  gap-4 ">
          <Link to="/" className="text-xl font-semibold">Cattle Scan</Link>
          <div className="flex gap-6">
            <Link to="/scan" >Scan</Link>
            <Link to="/explore" >Explore</Link>
            <Link to="/login" >User</Link>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>


    </>
  );
}

export default App;
