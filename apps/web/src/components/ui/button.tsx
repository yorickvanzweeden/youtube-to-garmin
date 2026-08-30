import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  const styles = {
    primary: "primary-button",
    secondary: "secondary-button",
    ghost: "cancel-button",
  };
  return (
    <button className={`${styles[variant]} ${className}`.trim()} {...props} />
  );
}
