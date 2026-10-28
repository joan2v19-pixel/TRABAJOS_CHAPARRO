import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';

@Component({
  imports: [
    FormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatTableModule
  ],
  selector: 'app-gestion-sena',
  styleUrl: './gestion-sena.css',
  templateUrl: './gestion-sena.html',
})
export class GestionSena implements OnInit {

  // Claves donde se guardan los datos en localStorage
  private readonly claveStorage = 'instructores_sena';
  private readonly claveStorageCompetencias = 'competencias_sena';
  private readonly claveStorageAsignaciones = 'asignaciones_sena';
  private readonly claveStorageFichas = 'fichas_sena';

  // Sección seleccionada
  seccion: string = '';

  // Control de los modales
  modalInstructorAbierto: boolean = false;
  modalCompetenciaAbierto: boolean = false;
  modalAsignacionAbierto: boolean = false;
  modalFichaAbierto: boolean = false;

  // IDs de los registros que se están editando (null = nuevo registro)
  idEditando: string | null = null;
  idCompetenciaEditando: string | null = null;
  idFichaEditando: string | null = null;

  // Opciones de los combos
  cargos: string[] = ['INSTRUCTOR', 'COORDINADOR', 'LIDER DE AREA'];
  tipos: string[] = ['TECNICA', 'TRANSVERSAL'];
  programas: string[] = ['TECNICO EN SOFTWARE','TECNOLOGO EN REDES','TECNOLOGO EN ANALISIS Y DESARROLLO DE SOFTWARE'];
  jornadas: string[] = ['MAÑANA', 'TARDE', 'NOCHE'];
  ambientes: string[] = ['LAB TI 101', 'AULA EMPRESARIAL', 'CENTRO DE SIMULACION'];

  // Datos del formulario
  instructor = {
    id: '',
    nombreCompleto: '',
    telefono: '',
    correo: '',
    cargo: '',
    planta: false,
    liderFicha: false
  };

  // Lista de registros guardados
  instructores: {
    id: string;
    nombreCompleto: string;
    telefono: string;
    correo: string;
    cargo: string;
    planta: boolean;
    liderFicha: boolean;
  }[] = [];

  // Datos del formulario de competencia
  competencia = {
    id: '',
    nombre: '',
    tipo: '',
    duracion: null as number | null
  };

  // Lista de competencias guardadas
  competencias: {
    id: string;
    nombre: string;
    tipo: string;
    duracion: number | null;
  }[] = [];

  // Datos del formulario de asignación
  asignacion = {
    idInstructor: '',
    idCompetencia: ''
  };

  // Lista de asignaciones guardadas
  asignaciones: {
    idInstructor: string;
    nombreInstructor: string;
    idCompetencia: string;
    nombreCompetencia: string;
  }[] = [];

  // Datos del formulario de ficha
  ficha = {
    idFicha: '',
    programa: '',
    jornada: '',
    idInstructorLider: '',
    nombreInstructorLider: '',
    ambiente: '',
    fechaInicio: '',
    fechaFin: ''
  };

  // Lista de fichas guardadas
  fichas: {
    idFicha: string;
    programa: string;
    jornada: string;
    idInstructorLider: string;
    nombreInstructorLider: string;
    ambiente: string;
    fechaInicio: string;
    fechaFin: string;
  }[] = [];

  // Columnas de la tabla
  displayedColumns: string[] = [
    'id',
    'nombreCompleto',
    'telefono',
    'correo',
    'cargo',
    'planta',
    'liderFicha',
    'acciones'
  ];

  // Columnas de la tabla de competencias
  displayedColumnsCompetencias: string[] = [
    'id',
    'nombre',
    'tipo',
    'duracion',
    'acciones'
  ];

  // Columnas de la tabla de asignaciones
  displayedColumnsAsignaciones: string[] = [
    'idInstructor',
    'nombreInstructor',
    'idCompetencia',
    'nombreCompetencia',
    'acciones'
  ];

  // Columnas de la tabla de fichas
  displayedColumnsFichas: string[] = [
    'idFicha',
    'programa',
    'jornada',
    'instructorLider',
    'ambiente',
    'fechaInicio',
    'fechaFin',
    'acciones'
  ];

  // Instructores que son líderes de ficha (para el combo)
  get instructoresLider() {
    return this.instructores.filter((instructor) => instructor.liderFicha);
  }

  // Al iniciar, cargar los datos guardados en localStorage
  ngOnInit(): void {
    this.cargarInstructores();
    this.cargarCompetencias();
    this.cargarAsignaciones();
    this.cargarFichas();
  }

  // Cambiar de sección
  mostrarSeccion(nombre: string): void {
    this.seccion = nombre;
  }

  // Cargar datos desde localStorage
  cargarInstructores(): void {
    const datos = localStorage.getItem(this.claveStorage);
    this.instructores = datos ? JSON.parse(datos) : [];
  }

  // Guardar la lista completa en localStorage
  private persistir(): void {
    localStorage.setItem(this.claveStorage, JSON.stringify(this.instructores));
  }

  // Abrir modal y limpiar formulario
  abrirModalInstructor(): void {
    this.instructor = {
      id: '',
      nombreCompleto: '',
      telefono: '',
      correo: '',
      cargo: '',
      planta: false,
      liderFicha: false
    };

    this.idEditando = null;
    this.modalInstructorAbierto = true;
  }

  // Cerrar modal
  cerrarModalInstructor(): void {
    this.modalInstructorAbierto = false;
  }

  // Guardar instructor (nuevo o editado) en localStorage
  guardarInstructor(): void {
    if (this.idEditando === null) {
      // Verificar que el ID no esté repetido
      const duplicado = this.instructores.some(
        (instructor) => instructor.id === this.instructor.id
      );

      if (duplicado) {
        alert('Ya existe un registro con el ID ' + this.instructor.id);
        return;
      }

      this.instructores.push({ ...this.instructor });
    } else {
      const indice = this.instructores.findIndex(
        (instructor) => instructor.id === this.idEditando
      );

      if (indice !== -1) {
        this.instructores[indice] = { ...this.instructor };
      }
    }

    this.persistir();
    this.cerrarModalInstructor();
  }

  // Cargar los datos al formulario para editarlos
  editarInstructor(instructor: {
    id: string;
    nombreCompleto: string;
    telefono: string;
    correo: string;
    cargo: string;
    planta: boolean;
    liderFicha: boolean;
  }): void {
    this.instructor = { ...instructor };
    this.idEditando = instructor.id;
    this.modalInstructorAbierto = true;
  }

  // Eliminar registro y actualizar localStorage
  eliminarInstructor(instructor: { id: string; nombreCompleto: string }): void {
    if (!confirm('¿Desea eliminar el registro de ' + instructor.nombreCompleto + '?')) {
      return;
    }

    this.instructores = this.instructores.filter(
      (registro) => registro.id !== instructor.id
    );

    this.persistir();
  }

  // ---- COMPETENCIAS ----

  // Cargar competencias desde localStorage
  cargarCompetencias(): void {
    const datos = localStorage.getItem(this.claveStorageCompetencias);
    this.competencias = datos ? JSON.parse(datos) : [];
  }

  // Guardar la lista completa de competencias en localStorage
  private persistirCompetencias(): void {
    localStorage.setItem(
      this.claveStorageCompetencias,
      JSON.stringify(this.competencias)
    );
  }

  // Abrir modal de competencia y limpiar formulario
  abrirModalCompetencia(): void {
    this.competencia = {
      id: '',
      nombre: '',
      tipo: '',
      duracion: null
    };

    this.idCompetenciaEditando = null;
    this.modalCompetenciaAbierto = true;
  }

  // Cerrar modal de competencia
  cerrarModalCompetencia(): void {
    this.modalCompetenciaAbierto = false;
  }

  // Guardar competencia (nueva o editada) en localStorage
  guardarCompetencia(): void {
    if (this.idCompetenciaEditando === null) {
      // Verificar que el ID no esté repetido
      const duplicado = this.competencias.some(
        (competencia) => competencia.id === this.competencia.id
      );

      if (duplicado) {
        alert('Ya existe una competencia con el ID ' + this.competencia.id);
        return;
      }

      this.competencias.push({ ...this.competencia });
    } else {
      const indice = this.competencias.findIndex(
        (competencia) => competencia.id === this.idCompetenciaEditando
      );

      if (indice !== -1) {
        this.competencias[indice] = { ...this.competencia };
      }
    }

    this.persistirCompetencias();
    this.cerrarModalCompetencia();
  }

  // Cargar los datos al formulario de competencia para editarlos
  editarCompetencia(competencia: {
    id: string;
    nombre: string;
    tipo: string;
    duracion: number | null;
  }): void {
    this.competencia = { ...competencia };
    this.idCompetenciaEditando = competencia.id;
    this.modalCompetenciaAbierto = true;
  }

  // Eliminar competencia y actualizar localStorage
  eliminarCompetencia(competencia: { id: string; nombre: string }): void {
    if (!confirm('¿Desea eliminar la competencia ' + competencia.nombre + '?')) {
      return;
    }

    this.competencias = this.competencias.filter(
      (registro) => registro.id !== competencia.id
    );

    this.persistirCompetencias();
  }

  // ---- ASIGNACIONES ----

  // Cargar asignaciones desde localStorage
  cargarAsignaciones(): void {
    const datos = localStorage.getItem(this.claveStorageAsignaciones);
    this.asignaciones = datos ? JSON.parse(datos) : [];
  }

  // Guardar la lista completa de asignaciones en localStorage
  private persistirAsignaciones(): void {
    localStorage.setItem(
      this.claveStorageAsignaciones,
      JSON.stringify(this.asignaciones)
    );
  }

  // Abrir modal de asignación y limpiar formulario
  abrirModalAsignacion(): void {
    this.asignacion = {
      idInstructor: '',
      idCompetencia: ''
    };

    this.modalAsignacionAbierto = true;
  }

  // Cerrar modal de asignación
  cerrarModalAsignacion(): void {
    this.modalAsignacionAbierto = false;
  }

  // Asignar una competencia a un instructor y guardar en localStorage
  asignar(): void {
    const instructor = this.instructores.find(
      (registro) => registro.id === this.asignacion.idInstructor
    );

    const competencia = this.competencias.find(
      (registro) => registro.id === this.asignacion.idCompetencia
    );

    if (!instructor || !competencia) {
      alert('Debe seleccionar un instructor y una competencia.');
      return;
    }

    // Verificar que la asignación no esté repetida
    const duplicada = this.asignaciones.some(
      (asignacion) =>
        asignacion.idInstructor === instructor.id &&
        asignacion.idCompetencia === competencia.id
    );

    if (duplicada) {
      alert('Esta asignación ya existe.');
      return;
    }

    this.asignaciones.push({
      idInstructor: instructor.id,
      nombreInstructor: instructor.nombreCompleto,
      idCompetencia: competencia.id,
      nombreCompetencia: competencia.nombre
    });

    this.persistirAsignaciones();
    this.cerrarModalAsignacion();
  }

  // Eliminar asignación y actualizar localStorage
  eliminarAsignacion(asignacion: {
    idInstructor: string;
    nombreInstructor: string;
    idCompetencia: string;
    nombreCompetencia: string;
  }): void {
    if (
      !confirm(
        '¿Desea eliminar la asignación de ' +
          asignacion.nombreInstructor +
          ' a ' +
          asignacion.nombreCompetencia +
          '?'
      )
    ) {
      return;
    }

    this.asignaciones = this.asignaciones.filter(
      (registro) =>
        !(
          registro.idInstructor === asignacion.idInstructor &&
          registro.idCompetencia === asignacion.idCompetencia
        )
    );

    this.persistirAsignaciones();
  }

  // ---- FICHAS TITULADAS ----

  // Cargar fichas desde localStorage
  cargarFichas(): void {
    const datos = localStorage.getItem(this.claveStorageFichas);
    this.fichas = datos ? JSON.parse(datos) : [];
  }

  // Guardar la lista completa de fichas en localStorage
  private persistirFichas(): void {
    localStorage.setItem(this.claveStorageFichas, JSON.stringify(this.fichas));
  }

  // Guardar el nombre del líder seleccionado en el formulario
  actualizarNombreLider(): void {
    const instructor = this.instructores.find(
      (registro) => registro.id === this.ficha.idInstructorLider
    );

    this.ficha.nombreInstructorLider = instructor ? instructor.nombreCompleto : '';
  }

  // Abrir modal de ficha y limpiar formulario
  abrirModalFicha(): void {
    this.ficha = {
      idFicha: '',
      programa: '',
      jornada: '',
      idInstructorLider: '',
      nombreInstructorLider: '',
      ambiente: '',
      fechaInicio: '',
      fechaFin: ''
    };

    this.idFichaEditando = null;
    this.modalFichaAbierto = true;
  }

  // Cerrar modal de ficha
  cerrarModalFicha(): void {
    this.modalFichaAbierto = false;
  }

  // Guardar ficha (nueva o editada) en localStorage
  guardarFicha(): void {
    // La fecha de inicio debe ser anterior a la fecha fin
    if (
      this.ficha.fechaInicio &&
      this.ficha.fechaFin &&
      this.ficha.fechaInicio > this.ficha.fechaFin
    ) {
      alert('La fecha de inicio debe ser anterior a la fecha fin.');
      return;
    }

    if (this.idFichaEditando === null) {
      // Verificar que el número de ficha no esté repetido
      const duplicada = this.fichas.some(
        (ficha) => ficha.idFicha === this.ficha.idFicha
      );

      if (duplicada) {
        alert('Ya existe una ficha con el número ' + this.ficha.idFicha);
        return;
      }

      this.fichas.push({ ...this.ficha });
    } else {
      const indice = this.fichas.findIndex(
        (ficha) => ficha.idFicha === this.idFichaEditando
      );

      if (indice !== -1) {
        this.fichas[indice] = { ...this.ficha };
      }
    }

    this.persistirFichas();
    this.cerrarModalFicha();
  }

  // Cargar los datos de una ficha al formulario para editarlos
  editarFicha(ficha: {
    idFicha: string;
    programa: string;
    jornada: string;
    idInstructorLider: string;
    nombreInstructorLider: string;
    ambiente: string;
    fechaInicio: string;
    fechaFin: string;
  }): void {
    this.ficha = { ...ficha };
    this.idFichaEditando = ficha.idFicha;
    this.modalFichaAbierto = true;
  }

  // Eliminar ficha y actualizar localStorage
  eliminarFicha(ficha: { idFicha: string; programa: string }): void {
    if (!confirm('¿Desea eliminar la ficha ' + ficha.idFicha + '?')) {
      return;
    }

    this.fichas = this.fichas.filter(
      (registro) => registro.idFicha !== ficha.idFicha
    );

    this.persistirFichas();
  }

}
