import { HydratedDocument } from 'mongoose';
import { ICategory, CategoryModel } from '../../models/mongodb/Category';
import { FilterOptions, SortOptions } from '../../helpers/interfaces';

export class CategoryRepository {
  static findAll(): Promise<HydratedDocument<ICategory>[]> {
    return CategoryModel.find();
  }

  static findById(id: string): Promise<HydratedDocument<ICategory> | null> {
    return CategoryModel.findById(id);
  }

  static async getPaginated(
    page: number,
    limit: number,
    sortOptions: SortOptions,
    filterOptions: FilterOptions,
  ): Promise<HydratedDocument<ICategory>[]> {
    const categories = await CategoryModel.find(filterOptions)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort(sortOptions);
    return categories;
  }

  static async getTotalCount(
    sortOptions: Record<string, unknown>,
    filterOptions: Record<string, unknown>,
  ): Promise<number> {
    return await CategoryModel.countDocuments(filterOptions, sortOptions);
  }
}
