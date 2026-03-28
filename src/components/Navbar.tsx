// TODO: Person A — Navigation bar
import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-primary">
          Senior Outing
        </Link>
        <div className="flex gap-4">
          <Link href="/senior/register" className="text-gray-600 hover:text-primary">
            Senior Sign Up
          </Link>
          <Link href="/volunteer/register" className="text-gray-600 hover:text-primary">
            Volunteer Sign Up
          </Link>
        </div>
      </div>
    </nav>
  );
}
