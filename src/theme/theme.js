import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  // ==========================================
  // TIPOGRAFÍA
  // ==========================================
  typography: {
    fontFamily: "'Montserrat', Arial, sans-serif",

    h4: {
      fontWeight: 700,
    },

    h5: {
      fontWeight: 700,
    },

    h6: {
      fontWeight: 600,
    },

    button: {
      textTransform: "none",
      fontWeight: 700,
    },
  },

  // ==========================================
  // COLORES CORPORATIVOS
  // ==========================================
  palette: {
    mode: "light",

    primary: {
      main: "#F4752D",
      light: "#FFB52E",
      dark: "#DC3D22",
      contrastText: "#FFFFFF",
    },

    secondary: {
      main: "#59351F",
      light: "#A68B78",
      dark: "#3D2415",
    },

    background: {
      default: "#FFF9F2",
      paper: "#FFFFFF",
    },

    text: {
      primary: "#59351F",
      secondary: "#8C7566",
    },

    divider: "#F0E4D9",

    success: {
      main: "#388E3C",
    },

    warning: {
      main: "#ED9A22",
    },

    error: {
      main: "#D84343",
    },
  },

  // ==========================================
  // BORDES
  // ==========================================
  shape: {
    borderRadius: 14,
  },

  // ==========================================
  // COMPONENTES GLOBALES
  // ==========================================
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          margin: 0,
        },

        "input:-webkit-autofill": {
          WebkitBoxShadow:
            "0 0 0 1000px #FFFFFF inset !important",
          WebkitTextFillColor:
            "#59351F !important",
          caretColor: "#59351F",
        },
      },
    },

    // ========================================
    // CAMPOS DE TEXTO
    // ========================================
    MuiTextField: {
      defaultProps: {
        fullWidth: true,
        variant: "outlined",
        size: "medium",
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,

          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#F4752D",
          },

          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#F4752D",
          },
        },
      },
    },

    // ========================================
    // BOTONES
    // ========================================
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },

      styleOverrides: {
        root: {
          borderRadius: 12,
          minHeight: 42,
          fontWeight: 700,
        },

        containedPrimary: {
          color: "#FFFFFF",

          background:
            "linear-gradient(105deg, #FFB52E, #FF852B 55%, #F45132)",

          "&:hover": {
            background:
              "linear-gradient(105deg, #F5A51C, #F47521 55%, #DC3D22)",
          },
        },
      },
    },

    // ========================================
    // TARJETAS
    // ========================================
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: "1px solid #F0E4D9",
          boxShadow:
            "0 8px 30px rgba(89, 53, 31, 0.06)",
        },
      },
    },

    // ========================================
    // PAPER
    // ========================================
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: 18,
        },
      },
    },

    // ========================================
    // TABLAS
    // ========================================
    MuiTableHead: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFF4E9",
        },
      },
    },

    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: "#59351F",
        },
      },
    },

    // ========================================
    // CHIPS
    // ========================================
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 10,
        },
      },
    },
  },
});