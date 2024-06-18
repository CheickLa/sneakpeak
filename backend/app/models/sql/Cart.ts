import {
  CreationOptional,
  DataTypes,
  Model,
  Sequelize,
  HasManyGetAssociationsMixin,
} from 'sequelize';
import syncWithMongoDB from '../../helpers/syncPsqlMongo';
import { CartProductRepository } from '../../repositories/sql/CartProductRepository';
import { UserRepository } from '../../repositories/sql/UserRepository';
import { VariantRepository } from '../../repositories/sql/VariantRepository';
import { CategoryRepository } from '../../repositories/sql/CategoryRepository';
import { BrandRepository } from '../../repositories/sql/BrandRepository';
import { SneakerRepository } from '../../repositories/sql/SneakerRepository';
import { CartProduct } from './CartProduct';
import { Operation } from '../../helpers/syncPsqlMongo';

export const SyncCartInMongoDB = async (Cart: Cart, type: Operation) => {
  const data = Cart.toJSON();
  const items = await CartProductRepository.findCartProductsByCartId(data.id);
  const user = await UserRepository.findById(data.user_id);
  data.user = user!.email;
  const cartProductPromises = items.map(async (item: CartProduct) => {
    const variant = await VariantRepository.findVariantById(item.variantId);
    const sneaker = await SneakerRepository.findSneakerById(variant!.sneakerId);
    const category = await CategoryRepository.findCategoryById(
      sneaker!.categoryId,
    );
    const brand = await BrandRepository.findBrandById(sneaker!.brandId);

    return {
      id: variant!.id,
      reference: sneaker!.name,
      name: sneaker!.name,
      category: category!.name,
      brand: brand!.name,
      image: variant!.image,
      quantity: item!.quantity,
      unitPrice: sneaker!.price,
      adjustement: 0,
      total: item.quantity * sneaker!.price,
    };
  });

  data.cartProduct = await Promise.all(cartProductPromises);
  data.totalCart = 1;
  data.modifiedAt = new Date();
  data.expiredAt = new Date(new Date().setDate(new Date().getMinutes() + 15));
  await syncWithMongoDB(Cart.constructor.name, type, data);
};
export class Cart extends Model {
  declare id: CreationOptional<number>;
  declare user_id: number;
  declare createdAt: Date;
  declare updatedAt: Date;
  declare expiredAt: Date;

  declare getCartProducts: HasManyGetAssociationsMixin<CartProduct>;
}

export default (sequelize: Sequelize) => {
  Cart.init(
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      expiredAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    },
    { sequelize, underscored: true },
  );

  Cart.afterCreate(async (cart) => {
    SyncCartInMongoDB(cart, 'create');
  });

  Cart.afterUpdate(async (cart) => {
    SyncCartInMongoDB(cart, 'update');
  });

  Cart.afterDestroy(async (cart) => {
    const data = cart.toJSON();
    await syncWithMongoDB(Cart.name, 'delete', data);
  });

  return Cart;
};
