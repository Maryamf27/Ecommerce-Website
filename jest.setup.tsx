import "@testing-library/jest-dom";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    <a href={href} {...props}>{children}</a>,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt = "", fill, priority, unoptimized }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    void fill;
    void priority;
    void unoptimized;
    return <span role="img" aria-label={alt} data-src={src} />;
  },
}));
