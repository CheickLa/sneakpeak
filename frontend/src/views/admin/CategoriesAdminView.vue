<script setup lang="ts">
import BasePageAdminView from './BasePageAdminView.vue'
import DataTable from '@/components/datatable/DataTable.vue'

const columns = [{ key: 'name', label: 'Nom' }]
</script>

<template>
  <BasePageAdminView>
    <DataTable
      :columns="columns"
      resource="categories"
      uniqueKey="slug"
      headerTitle="Catégories"
      path="/admin/categories"
    />
  </BasePageAdminView>
</template>
