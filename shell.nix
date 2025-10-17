{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    bun
  ];

  shellHook = ''
    echo "Bun development environment loaded"
    echo "Bun version: $(bun --version)"
  '';
}
