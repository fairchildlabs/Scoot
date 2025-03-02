import { FairchildLabsLogo } from "../logos/fairchild-labs-logo";

export function Footer() {
  return (
    <footer className="bg-black border-t border-border py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4">
          <FairchildLabsLogo className="h-8 text-white" />
          <p className="text-white opacity-70 text-sm">
            © {new Date().getFullYear()} Fairchild Labs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
