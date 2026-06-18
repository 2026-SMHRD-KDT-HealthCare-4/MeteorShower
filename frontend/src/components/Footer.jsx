export default function Footer() {
  return (
    <footer className="w-full py-4 bg-surface-container-lowest border-t border-outline-variant mt-auto">
      <div className="flex flex-col md:flex-row justify-between items-center px-container-padding-mobile md:px-margin-desktop w-full max-w-7xl mx-auto min-h-[64px]">
        <div className="text-label-md text-on-surface-variant text-center md:text-left">
          © 2024 피네(Fine) Hand Rehabilitation. All rights reserved.
        </div>
        <div className="flex gap-6 mt-4 md:mt-0 text-label-md">
          <a href="#" className="text-on-surface-variant hover:text-primary-container transition-colors">Privacy Policy</a>
          <a href="#" className="text-on-surface-variant hover:text-primary-container transition-colors">Terms of Service</a>
          <a href="#" className="text-on-surface-variant hover:text-primary-container transition-colors">Contact Us</a>
        </div>
      </div>
    </footer>
  );
}
